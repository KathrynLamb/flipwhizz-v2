import { inngest } from "./client";
import { db } from "@/db";
import {
  stories,
  coverChatSessions,
  storyStyleGuide,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                CONFIG                                      */
/* -------------------------------------------------------------------------- */

const MODEL = "claude-sonnet-4-20250514";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* -------------------------------------------------------------------------- */
/*                              SCHEMA                                        */
/* -------------------------------------------------------------------------- */

const CoverSpreadSceneSchema = z.object({
  sceneSummary: z.string().min(1),
  illustrationPrompt: z.string().min(50),
  compositionNotes: z.array(z.string()).default([]),
  mood: z.string().optional(),
  doNotInclude: z.array(z.string()).default([]),
});

/* -------------------------------------------------------------------------- */
/*                              HELPERS                                       */
/* -------------------------------------------------------------------------- */

function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("\n")
    .trim();
}

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const text = (fenced?.[1] ?? raw).trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("Claude did not return valid JSON");
  }

  return JSON.parse(text.slice(first, last + 1));
}

/* -------------------------------------------------------------------------- */
/*                               FUNCTION                                     */
/* -------------------------------------------------------------------------- */

export const planCoverSpread = inngest.createFunction(
  {
    id: "plan-cover-spread",
    retries: 2,
  },
  { event: "cover/plan" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId?: string };
    if (!storyId) throw new Error("storyId required");

    /* --------------------------------------------------
       1️⃣ Load story + cover plan + style
    -------------------------------------------------- */

    const data = await step.run("load-cover-context", async () => {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      });
      if (!story) throw new Error("Story not found");

      const session = await db.query.coverChatSessions.findFirst({
        where: eq(coverChatSessions.storyId, storyId),
      });
      if (!session?.coverPlan) {
        throw new Error("Cover plan not found (chat not completed)");
      }

      const style = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      return {
        story,
        coverPlan: session.coverPlan,
        style,
      };
    });

    /* --------------------------------------------------
       2️⃣ Claude: plan the cover spread scene
    -------------------------------------------------- */

    const scene = await step.run("claude-plan-cover-spread", async () => {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1200,
        system: `
You are a senior children's book art director.

You are planning a SINGLE WIDE WRAP-AROUND COVER SPREAD.

IMPORTANT:
- This is ONE image.
- LEFT side = BACK COVER (calmer, more negative space).
- RIGHT side = FRONT COVER (hero focus).
- The center gutter must be visually quiet.
- NO TEXT. Text is handled later.

You must return ONLY JSON in this exact shape:

{
  "sceneSummary": "...",
  "illustrationPrompt": "...",
  "compositionNotes": ["..."],
  "mood": "...",
  "doNotInclude": ["..."]
}
`.trim(),
        messages: [
          {
            role: "user",
            content: `
STORY TITLE:
${data.story.title}

COVER PLAN (from user conversation):
${JSON.stringify(data.coverPlan, null, 2)}

STYLE GUIDE:
${JSON.stringify(
  {
    summary: data.style?.summary,
    artStyle: data.style?.artStyle,
    visualThemes: data.style?.visualThemes,
    negativePrompt: data.style?.negativePrompt,
    colorPalette: data.style?.colorPalette,
  },
  null,
  2
)}

TASK:
Describe the full wrap-around illustration visually.

RULES:
- Describe ONLY visuals (no layout labels, no text instructions)
- Back cover side should feel calmer and more open
- Front cover side should be visually stronger
- Ensure the image works when cropped into front/back
- Avoid clutter in the center gutter
- Target audience: children aged 3–8
`,
          },
        ],
      });

      const raw = extractClaudeText(res.content);
      const parsed = extractJson(raw);
      return CoverSpreadSceneSchema.parse(parsed);
    });

    /* --------------------------------------------------
       3️⃣ Persist scene plan
    -------------------------------------------------- */

    await step.run("save-cover-scene", async () => {
      await db
        .update(coverChatSessions)
        .set({
          coverPlan: {
            ...data.coverPlan,
            scene: scene,
          },
          planUpdatedAt: new Date(),
        })
        .where(eq(coverChatSessions.storyId, storyId));
    });

    /* --------------------------------------------------
       4️⃣ Trigger render phase
    -------------------------------------------------- */

    await step.run("trigger-cover-render", async () => {
      await inngest.send({
        name: "cover/render",
        data: {
          storyId,
        },
      });
    });

    return {
      success: true,
      sceneSummary: scene.sceneSummary,
    };
  }
);

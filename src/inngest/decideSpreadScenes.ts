// src/inngest/decideScenes.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  storyCharacters,
  characters,
  storyWorkflowProgress,
  storySpreadPresence,
  locations,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514";

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const text = (fenced?.[1] ?? raw).trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  const json = first !== -1 && last !== -1 ? text.slice(first, last + 1) : text;
  return JSON.parse(json);
}

function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("\n")
    .trim();
}

export const decideScenes = inngest.createFunction(
  {
    id: "decide-scenes-v2", 
    retries: 2,
  },
  { event: "story/decide-spread-scenes" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🔵 [decide-scenes] Starting for story:", storyId);

    /* --------------------------------------------------
       STEP 1: Load spreads
    -------------------------------------------------- */
    const spreads = await step.run("load-spreads", async () => {
      return db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
      });
    });

    /* --------------------------------------------------
       STEP 2: Load pages
    -------------------------------------------------- */
    const pageIds = spreads
      .flatMap(s => [s.leftPageId, s.rightPageId])
      .filter(Boolean) as string[];

    const pages = await step.run("load-pages", async () => {
      return db.query.storyPages.findMany({
        where: inArray(storyPages.id, pageIds),
      });
    });

    const pageMap = new Map(pages.map(p => [p.id, p]));

    /* --------------------------------------------------
       STEP 3: Load characters
    -------------------------------------------------- */
    const storyChars = await step.run("load-story-characters", async () => {
      return db.query.storyCharacters.findMany({
        where: eq(storyCharacters.storyId, storyId),
      });
    });

    const charIds = storyChars.map(sc => sc.characterId);

    const chars = await step.run("load-characters", async () => {
      if (charIds.length === 0) return [];
      return db.query.characters.findMany({
        where: inArray(characters.id, charIds),
      });
    });

    /* --------------------------------------------------
       STEP 4: Load locations
    -------------------------------------------------- */
    const storyLocs = await step.run("load-locations", async () => {
      const locs = await db.query.storyLocations.findMany({
        where: eq(storyCharacters.storyId, storyId),
      });
      
      if (locs.length === 0) return [];
      
      const locIds = locs.map(sl => sl.locationId);
      return db.query.locations.findMany({
        where: inArray(locations.id, locIds),
      });
    });

    /* --------------------------------------------------
       STEP 5: Call Claude to assign characters/locations
    -------------------------------------------------- */
    const assignments = await step.run("decide-with-claude", async () => {
      const spreadTexts = spreads.map((s, i) => {
        const leftPage = s.leftPageId ? pageMap.get(s.leftPageId) : null;
        const rightPage = s.rightPageId ? pageMap.get(s.rightPageId) : null;
        const left = leftPage?.text || "";
        const right = rightPage?.text || "";
        return `SPREAD ${i + 1}:\nLeft: ${left}\nRight: ${right}`;
      }).join("\n\n");

      const charList = chars.map(c => `${c.name} (${c.id})`).join(", ");
      const locList = storyLocs.map(l => `${l.name} (${l.id})`).join(", ");

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: `For each spread, decide which characters appear and which location is primary.
Return ONLY JSON:
{
  "spreads": [
    {
      "spreadIndex": 1,
      "primaryLocationId": "uuid-or-null",
      "characters": [
        {
          "characterId": "uuid",
          "role": "primary",
          "confidence": 0.9,
          "reason": "Main character in this scene"
        }
      ],
      "reasoning": "Brief explanation"
    }
  ]
}

Role must be: "primary", "secondary", or "background"
Confidence: 0 to 1`,
        messages: [{
          role: "user",
          content: `Characters: ${charList}\nLocations: ${locList}\n\n${spreadTexts}`
        }],
      });

      return extractJson(extractClaudeText(res.content));
    });

    /* --------------------------------------------------
       STEP 6: Save spread presence records
    -------------------------------------------------- */
    await step.run("save-spread-presence", async () => {
      for (const assignment of assignments.spreads || []) {
        const spread = spreads[assignment.spreadIndex - 1];
        if (!spread) continue;

        await db.insert(storySpreadPresence).values({
          id: uuid(),
          spreadId: spread.id,
          primaryLocationId: assignment.primaryLocationId || null,
          characters: assignment.characters || [],
          excludedCharacters: [],
          reasoning: assignment.reasoning || null,
          source: "claude",
          locked: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    console.log("✅ [decide-scenes] Assigned characters/locations to spreads");

    /* --------------------------------------------------
       STEP 7: Mark workflow complete
    -------------------------------------------------- */
    await step.run("mark-complete", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          scenesDecided: true,
          scenesDecidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      console.log("✅ [decide-scenes] Workflow complete!");
    });

    return { ok: true };
  }
);
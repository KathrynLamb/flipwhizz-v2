

// src/app/api/stories/cover-chat/route.ts
//
// v2: Claude as art director.
// - Warm layman chat with the parent
// - Internally decides generation strategy (two-pass / single / edit)
// - Writes the exact Gemini prompts (never shown to user)
// - Stores strategy in coverPlan.generationStrategy

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  stories,
  storyStyleGuide,
  coverChatSessions,
  coverChatMessages,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TOOL_NAME = "cover_chat_response";

type CoverStage = "greeting" | "title" | "image" | "backcover" | "author" | "ready";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      storyId,
      message,
      stage = "greeting",
      confirmedTitle,
      backCoverContent,
      authorCredit,
      world,
      coverCharacterIds = [],
      coverLocationIds = [],
    } = body;

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // ── Load story ──
    const storyData = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!storyData) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // ── Load style ──
    const styleData = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    const chars = world?.characters ?? [];
    const locs = world?.locations ?? [];

    // ── Get or create session ──
    let session = await db
      .select()
      .from(coverChatSessions)
      .where(eq(coverChatSessions.storyId, storyId))
      .then((r) => r[0]);

    if (!session) {
      const [created] = await db
        .insert(coverChatSessions)
        .values({ id: uuid(), storyId, coverPlan: null, createdAt: new Date() })
        .returning();
      session = created;
    }

    // ── Save user message ──
    if (message && message !== "__START__") {
      await db.insert(coverChatMessages).values({
        id: uuid(),
        sessionId: session.id,
        role: "user",
        content: message,
        createdAt: new Date(),
      });
    }

    // ── Build context ──
    const charNames = chars.map((c: any) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ");
    const locNames = locs.map((l: any) => l.name).join(", ");
    const protagonist = chars.find((c: any) => c.role === "protagonist" || c.role === "main");
    const protagonistName = protagonist?.name || chars[0]?.name || "the reader";
    const currentTitle = confirmedTitle || storyData.title;
    const existingCoverUrl = storyData.coverSpreadUrl;

    // ── System prompt ──
    const SYSTEM = buildSystemPrompt({
      stage: stage as CoverStage,
      title: currentTitle,
      summary: storyData.description || "",
      fullDraft: storyData.fullDraft?.slice(0, 600) || "",
      charNames,
      locNames,
      protagonistName,
      artStyle: styleData?.artStyle || "Children's Book Illustration",
      styleNotes: styleData?.summary || "",
      negativePrompt: styleData?.negativePrompt || "",
      confirmedTitle: confirmedTitle || null,
      backCoverContent: backCoverContent || null,
      authorCredit: authorCredit || null,
      characters: chars,
      locations: locs,
      existingCoverUrl,
    });

    // ── Load history ──
    const dbHistory = await db
      .select({ role: coverChatMessages.role, content: coverChatMessages.content })
      .from(coverChatMessages)
      .where(eq(coverChatMessages.sessionId, session.id))
      .orderBy(asc(coverChatMessages.createdAt));

    const claudeMessages = dbHistory.length > 0
      ? dbHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : [{ role: "user" as const, content: message === "__START__"
          ? "Hi! I'm ready to design the cover for my book."
          : message }];

    // ── Call Claude ──
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM,
      tools: [
        {
          name: TOOL_NAME,
          description: "Respond to the parent and optionally update cover plan data.",
          input_schema: {
            type: "object" as const,
            required: ["message"],
            properties: {
              message: { type: "string", description: "Your warm, conversational response to the parent (3-5 sentences max). Never expose technical details." },
              nextStage: { type: "string", enum: ["greeting", "title", "image", "backcover", "author", "ready"], description: "Only include to advance stage." },
              confirmedTitle: { type: "string", description: "The final agreed title." },
              coverCharacterIds: { type: "array", items: { type: "string" }, description: "Character IDs for the front cover." },
              coverLocationIds: { type: "array", items: { type: "string" }, description: "Location IDs for the cover." },
              backCoverContent: { type: "string", description: "Back cover text (blurb, dedication, or message)." },
              authorCredit: { type: "string", description: "Author credit line." },
              generationStrategy: {
                type: "object",
                description: "ONLY include when stage is 'ready' and user wants to generate. This is the complete generation strategy.",
                properties: {
                  approach: { type: "string", enum: ["two-pass", "single", "edit"], description: "two-pass for new covers with characters, single for simple/text-only covers, edit to modify existing cover." },
                  pass1Prompt: { type: "string", description: "The EXACT prompt for Gemini Pass 1 (composition). Include all scene details, text to render, layout instructions. Do NOT describe character appearances." },
                  pass2Prompt: { type: "string", description: "The EXACT prompt for Gemini Pass 2 (character swap). Instructs Gemini to recreate the Pass 1 image but with the character references." },
                  includeStyleRef: { type: "boolean" },
                  includeTemplate: { type: "boolean" },
                  includeLogo: { type: "boolean" },
                  aspectRatio: { type: "string", description: "e.g. 16:9 for wrap spread" },
                  imageSize: { type: "string", description: "1K, 2K, or 4K" },
                  existingCoverUrl: { type: "string", description: "For edit approach: URL of cover to modify." },
                  editPrompt: { type: "string", description: "For edit approach: what to change." },
                },
              },
            },
          },
        },
      ],
      tool_choice: { type: "tool" as const, name: TOOL_NAME },
      messages: claudeMessages,
    });

    // ── Extract ──
    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME
    );

    if (!toolBlock) {
      return NextResponse.json({ message: "Sorry — something went wrong. Please try again." });
    }

    const payload = toolBlock.input as any;

    // ── Fallback: inject character IDs if advancing from image stage without them ──
    if (stage === "image" && payload.nextStage === "backcover") {
      if (!payload.coverCharacterIds?.length) {
        payload.coverCharacterIds = chars.map((c: any) => c.id);
      }
      if (!payload.coverLocationIds?.length) {
        const msgLower = (message || "").toLowerCase();
        const matchedLoc = locs.find((l: any) => msgLower.includes(l.name.toLowerCase()));
        if (matchedLoc) payload.coverLocationIds = [matchedLoc.id];
      }
    }

    console.log("🎨 Cover chat response:", {
      message: payload.message?.substring(0, 80),
      nextStage: payload.nextStage,
      hasStrategy: !!payload.generationStrategy,
      approach: payload.generationStrategy?.approach,
    });

    // ── Save assistant message ──
    if (payload.message) {
      await db.insert(coverChatMessages).values({
        id: uuid(),
        sessionId: session.id,
        role: "assistant",
        content: payload.message,
        createdAt: new Date(),
      });
    }

    // ── Update cover plan ──
    const planUpdate: any = {};
    if (payload.confirmedTitle) planUpdate.titleText = payload.confirmedTitle;
    if (payload.coverCharacterIds?.length) planUpdate.coverCharacterIds = payload.coverCharacterIds;
    if (payload.coverLocationIds?.length) planUpdate.coverLocationIds = payload.coverLocationIds;
    if (payload.backCoverContent) planUpdate.backCoverText = payload.backCoverContent;
    if (payload.authorCredit) planUpdate.authorText = payload.authorCredit;

    // If generation strategy is provided, save it to the story's coverPlan
    if (payload.generationStrategy) {
      const charIds = payload.coverCharacterIds ?? coverCharacterIds ?? [];
      const locIds = payload.coverLocationIds ?? coverLocationIds ?? [];

      const fullStrategy = {
        ...payload.generationStrategy,
        characterIds: charIds,
        locationIds: locIds,
      };

      // Save to story.coverPlan
      const existingPlan = (storyData.coverPlan as any) || {};
      await db.update(stories).set({
        coverPlan: {
          ...existingPlan,
          ...planUpdate,
          format: "wrap-spread",
          front: {
            titleText: payload.confirmedTitle || confirmedTitle || currentTitle,
            authorText: payload.authorCredit || authorCredit || existingPlan?.front?.authorText,
            visualIntent: "See generationStrategy",
          },
          spine: { spineText: payload.confirmedTitle || confirmedTitle || currentTitle },
          back: {
            blurbText: payload.backCoverContent || backCoverContent || existingPlan?.back?.blurbText,
            visualIntent: "See generationStrategy",
          },
          coverCharacterIds: charIds,
          coverLocationIds: locIds,
          generationStrategy: fullStrategy,
        },
        coverPlanLocked: true,
        updatedAt: new Date(),
      }).where(eq(stories.id, storyId));

      console.log("🎨 Generation strategy saved:", fullStrategy.approach);
    } else if (Object.keys(planUpdate).length > 0) {
      // Just update session plan (no strategy yet)
      const existing = (session.coverPlan as any) || {};
      await db.update(coverChatSessions).set({
        coverPlan: { ...existing, ...planUpdate },
        planUpdatedAt: new Date(),
      }).where(eq(coverChatSessions.id, session.id));
    }

    return NextResponse.json({
      message: payload.message,
      stage: payload.nextStage || undefined,
      confirmedTitle: payload.confirmedTitle || undefined,
      coverCharacterIds: payload.coverCharacterIds || undefined,
      coverLocationIds: payload.coverLocationIds || undefined,
      backCoverContent: payload.backCoverContent || undefined,
      authorCredit: payload.authorCredit || undefined,
      hasStrategy: !!payload.generationStrategy,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("🎨 Cover chat error:", err);
    return NextResponse.json(
      { error: "Cover chat failed", details: err.message },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  SYSTEM PROMPT                                                              */
/* -------------------------------------------------------------------------- */

function buildSystemPrompt(ctx: {
  stage: CoverStage;
  title: string;
  summary: string;
  fullDraft: string;
  charNames: string;
  locNames: string;
  protagonistName: string;
  artStyle: string;
  styleNotes: string;
  negativePrompt: string;
  confirmedTitle: string | null;
  backCoverContent: string | null;
  authorCredit: string | null;
  characters: any[];
  locations: any[];
  existingCoverUrl: string | null;
}): string {
  const base = `
You are FlipWhizz's cover designer — warm, encouraging, and creative.
You're helping a parent create a beautiful cover for their child's personalised storybook.

You have TWO jobs:
1. VISIBLE: Chat warmly with the parent about what they want on the cover.
2. INVISIBLE: You are also a Gemini image generation expert. When it's time to generate, you write the EXACT prompts that will be sent to Gemini (Nano Banana Pro). The parent NEVER sees these prompts.

STORY: "${ctx.title}"
SUMMARY: ${ctx.summary || ctx.fullDraft || "A personalised children's story."}
CHARACTERS: ${ctx.charNames || "Not specified"}
LOCATIONS: ${ctx.locNames || "Not specified"}
ART STYLE: ${ctx.artStyle}
STYLE NOTES: ${ctx.styleNotes}
${ctx.existingCoverUrl ? `EXISTING COVER: ${ctx.existingCoverUrl}` : ""}

AVAILABLE CHARACTER IDS:
${ctx.characters.map((c: any) => `  "${c.name}" → ID: "${c.id}"`).join("\n")}

AVAILABLE LOCATION IDS:
${ctx.locations.map((l: any) => `  "${l.name}" → ID: "${l.id}"`).join("\n")}

RULES FOR TALKING TO THE PARENT:
- 3-5 sentences max per response. Warm but concise.
- Use the child's name (${ctx.protagonistName}) naturally.
- NEVER mention "prompts", "Gemini", "passes", "AI", "generation strategy", or any technical terms.
- NEVER use markdown bold (**text**).
- Suggest concrete options, don't be vague.

RULES FOR WRITING GEMINI PROMPTS (generationStrategy):
You are an expert at prompting Gemini's Nano Banana Pro image model. You know:

1. CHARACTER FIDELITY: Gemini can match up to 5 character reference images with high fidelity. BUT when you overload the prompt with text layout + character refs + scene description, fidelity drops. Solution: TWO-PASS approach.

2. TWO-PASS APPROACH (use for covers with characters):
   - Pass 1 (pass1Prompt): Scene composition, text layout, background, mood. Include character NAMES and POSITIONS but NOT their appearance. Gemini will create placeholder characters. Include all text to render (title, author, blurb, spine).
   - Pass 2 (pass2Prompt): "Recreate this image exactly — same layout, same text, same background, same composition. But replace the characters with the ones shown in the reference images. Keep everything else identical."

3. SINGLE APPROACH (use for covers without characters or very simple covers):
   - One prompt with everything.

4. EDIT APPROACH (use when modifying an existing cover):
   - Send the existing cover + portraits + edit instructions.

5. PROMPT WRITING RULES:
   - NEVER describe character appearances in prompts. The reference images handle that.
   - DO describe: scene, action, mood, setting, lighting, composition, camera angle.
   - DO specify exact text to render: title, author credit, spine text, back cover text.
   - DO specify: "wrap-around children's book cover, 16:9 landscape, back cover on the left third, spine in the centre strip, front cover on the right two-thirds."
   - DO include: "Hand-lettered text, large, child-friendly, high contrast."
   - DO include: "Keep ALL text inside safe zones — outer 10% is trimmed. NO BARCODES. NO ISBN."
   - AVOID: ${ctx.negativePrompt || "Photorealism, CGI, barcodes, ISBN, watermarks"}
   - For pass2Prompt, be very explicit: "Recreate this EXACT image. Same layout, same text, same colours, same background. ONLY change the characters to match the reference portraits shown above. Do NOT change anything else."

6. IMAGE CONFIG:
   - aspectRatio: "16:9" for wrap spreads, "3:4" for front-only, "4:3" for landscape front-only
   - imageSize: "2K" (default) or "4K" for high quality
   - includeStyleRef: true (unless user wants a completely different style)
   - includeTemplate: true (for wrap spreads)
   - includeLogo: true (for wrap spreads)
`.trim();

  const stageInstructions: Record<CoverStage, string> = {
    greeting: `
CURRENT STAGE: GREETING
Give a warm 2-sentence greeting mentioning ${ctx.protagonistName}.
Ask ONLY about the title: "The title is currently '${ctx.title}' — do you love it, or would you like to change it?"
Set nextStage to "title".
Do NOT ask about anything else.`,

    title: `
CURRENT STAGE: TITLE
Only discuss the title. Current: "${ctx.title}".
When confirmed → set confirmedTitle, set nextStage to "image", end with "Now, who should be on the front cover?"
Do NOT discuss cover image, back cover, or author yet.`,

    image: `
CURRENT STAGE: COVER IMAGE
Discuss the front cover illustration. Guide them through:
- Which characters on the front? (suggest protagonist + 1-2 key characters)
- What scene or setting? (suggest from available locations)
- What mood? (funny, adventurous, cozy)

When both characters and location are confirmed:
→ Set coverCharacterIds and coverLocationIds
→ Set nextStage to "backcover"
→ End with: "Now for the back cover — would you like a dedication, a character message, or a short blurb?"`,

    backcover: `
CURRENT STAGE: BACK COVER
Help with back cover content. Options: dedication, character message, blurb, or skip.
When decided → set backCoverContent, set nextStage to "author".`,

    author: `
CURRENT STAGE: AUTHOR CREDIT
Discuss author credit. Suggest options: parent's name, "Written by [Name] & FlipWhizz", child as author, etc.
When decided → set authorCredit, set nextStage to "ready".
→ Say: "We've got everything! Hit Generate Cover whenever you're ready."`,

    ready: `
CURRENT STAGE: READY
The plan is complete. Title: ${ctx.confirmedTitle || ctx.title}, Back: ${ctx.backCoverContent || "Not set"}, Author: ${ctx.authorCredit || "Not set"}.

If the parent says "generate", "go", "do it", "make it", "create it", or similar:
→ Include generationStrategy in your response with the full prompts.
→ Decide: two-pass (if characters involved), single (if no characters), or edit (if modifying existing).
→ Write both pass1Prompt and pass2Prompt.
→ Say something like "Generating your cover now — about 30-60 seconds!"

If they want to tweak something, help them and update the relevant field.
${ctx.existingCoverUrl ? `If they want to modify the existing cover, use the "edit" approach with existingCoverUrl.` : ""}`,
  };

  return `${base}\n\n${stageInstructions[ctx.stage]}`;
}
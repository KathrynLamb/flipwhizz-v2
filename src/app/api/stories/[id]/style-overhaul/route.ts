// src/app/api/stories/[id]/style-overhaul/route.ts
//
// Powers the Style Overhaul chat modal.
// Claude has full read/write access to everything that feeds into Gemini:
//   - storyStyleGuide: userNotes (main prompt), artStyle, negativePrompt, sampleIllustrationUrl (style ref image)
//   - storySpreadScene: illustrationPrompt, mood, compositionNotes (per spread — PRIMARY prompt source)
//   - storySpreads: sceneSummary (per spread — fallback if no scene record)
//   - locations: portraitImageUrl, referenceImageUrl (can null to stop location anchoring)
//
// The pipeline priority is: scene.illustrationPrompt > strategistPlan.recommendedPrompt > sceneSummary
// The strongest Gemini anchor is the style reference IMAGE, not text.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyStyleGuide,
  storySpreadScene,
  storySpreads,
  storyPages,
  characters,
  storyCharacters,
  locations,
  storyLocations,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Message = { role: "user" | "assistant"; content: string };

type StyleMutation =
  | { type: "update_style_guide"; fields: Record<string, any> }
  | { type: "update_spread_scene"; spreadId: string; fields: { illustrationPrompt?: string; mood?: string; compositionNotes?: string[] } }
  | { type: "update_spread_summary"; spreadId: string; sceneSummary: string }
  | { type: "null_location_images" }
  | { type: "null_style_ref" };

type StyleOverhaulPlan = {
  diagnosis: string[];
  mutations: StyleMutation[];
  sampleSpreadIndex: number;
  notesToUser: string;
  readyForFullRedraw: boolean;
};

function xmlEscape(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractTaggedBlock(text: string, tag: string) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m?.[1]?.trim() ?? null;
}

async function loadStoryContext(storyId: string) {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!story) throw new Error("Story not found");

  const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });

  const spreads = await db
    .select({
      id: storySpreads.id,
      spreadIndex: storySpreads.spreadIndex,
      sceneSummary: storySpreads.sceneSummary,
      leftPageId: storySpreads.leftPageId,
      rightPageId: storySpreads.rightPageId,
    })
    .from(storySpreads)
    .where(eq(storySpreads.storyId, storyId))
    .orderBy(asc(storySpreads.spreadIndex));

  const spreadIds = spreads.map((s) => s.id);

  const scenes = spreadIds.length > 0
    ? await db
        .select({
          spreadId: storySpreadScene.spreadId,
          illustrationPrompt: storySpreadScene.illustrationPrompt,
          mood: storySpreadScene.mood,
          compositionNotes: storySpreadScene.compositionNotes,
        })
        .from(storySpreadScene)
        .where(inArray(storySpreadScene.spreadId, spreadIds))
    : [];

  const sceneBySpreadId = Object.fromEntries(scenes.map((s) => [s.spreadId, s]));

  // Sample current images from first 3 spreads
  const samplePageIds = spreads
    .slice(0, 3)
    .flatMap((s) => [s.leftPageId, s.rightPageId].filter(Boolean) as string[]);

  const samplePages = samplePageIds.length > 0
    ? await db
        .select({ id: storyPages.id, imageUrl: storyPages.imageUrl })
        .from(storyPages)
        .where(inArray(storyPages.id, samplePageIds))
    : [];

  const pageImageMap = Object.fromEntries(samplePages.map((p) => [p.id, p.imageUrl]));

  const chars = await db
    .select({
      id: characters.id,
      name: characters.name,
      portraitUrl: characters.portraitImageUrl,
      species: characters.species,
    })
    .from(storyCharacters)
    .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
    .where(eq(storyCharacters.storyId, storyId));

  const locs = await db
    .select({
      id: locations.id,
      name: locations.name,
      portraitUrl: locations.portraitImageUrl,
      refUrl: locations.referenceImageUrl,
    })
    .from(storyLocations)
    .innerJoin(locations, eq(storyLocations.locationId, locations.id))
    .where(eq(storyLocations.storyId, storyId));

  return {
    story,
    style,
    spreads: spreads.map((s) => ({
      ...s,
      scene: sceneBySpreadId[s.id] ?? null,
      sampleImageUrl:
        pageImageMap[s.leftPageId ?? ""] ??
        pageImageMap[s.rightPageId ?? ""] ??
        null,
    })),
    chars,
    locs,
  };
}

function buildContextXml(ctx: Awaited<ReturnType<typeof loadStoryContext>>) {
  const { story, style, spreads, chars, locs } = ctx;

  const styleXml = `<style_guide>
  <main_prompt>${xmlEscape(style?.userNotes ?? style?.artStyle ?? "")}</main_prompt>
  <art_style>${xmlEscape(style?.artStyle ?? "")}</art_style>
  <negative_prompt>${xmlEscape(style?.negativePrompt ?? "")}</negative_prompt>
  <style_reference_image>${style?.sampleIllustrationUrl ? "YES — " + xmlEscape(style.sampleIllustrationUrl) : "NONE"}</style_reference_image>
  <note>The style reference IMAGE is the strongest anchor for Gemini — it overrides text prompts visually.</note>
</style_guide>`;

  const spreadsXml = spreads.map((s) => `<spread index="${s.spreadIndex}" id="${s.id}">
  <scene_summary>${xmlEscape(s.sceneSummary ?? "")}</scene_summary>
  <illustration_prompt>${xmlEscape(s.scene?.illustrationPrompt ?? "NONE — scene summary will be used")}</illustration_prompt>
  <mood>${xmlEscape(s.scene?.mood ?? "")}</mood>
  <has_generated_image>${s.sampleImageUrl ? "YES" : "NO"}</has_generated_image>
</spread>`).join("\n");

  const charsXml = chars.map((c) =>
    `<character id="${c.id}" name="${xmlEscape(c.name)}" species="${xmlEscape(c.species ?? "human")}" has_portrait="${c.portraitUrl ? "YES" : "NO"}"/>`
  ).join("\n");

  const locsXml = locs.map((l) =>
    `<location id="${l.id}" name="${xmlEscape(l.name)}" has_image="${l.portraitUrl || l.refUrl ? "YES — this is sent to Gemini as a visual anchor" : "NO"}"/>`
  ).join("\n");

  return `<story_context>
  <title>${xmlEscape(story.title)}</title>
  <story_id>${story.id}</story_id>
  ${styleXml}
  <spreads total="${spreads.length}">
${spreadsXml}
  </spreads>
  <characters>
${charsXml}
  </characters>
  <locations>
${locsXml}
  </locations>
  <pipeline_note>
    Gemini receives in order: character portraits → style reference image → location image → layout template → illustration_prompt text.
    Images anchor the output far more strongly than text. To change the aesthetic, you must change what images are sent.
    null_style_ref removes the style reference image entirely. null_location_images removes all location reference images.
  </pipeline_note>
</story_context>`;
}

function buildSystemPrompt() {
  return `You are FlipWhizz's Style Overhaul AI — a senior art director and Gemini prompt engineer.

The user has generated illustrations for their children's storybook and is unhappy with the overall visual style. Your job is to diagnose WHY and prescribe EXACTLY what to change in the generation pipeline.

CRITICAL TECHNICAL KNOWLEDGE — you must apply this:
Gemini receives inputs in this order: character portraits → style reference image → location image → layout template → illustration_prompt text.
Images anchor the output FAR more strongly than text. A conventional picture book style reference image will produce picture book illustrations regardless of what the text prompt says.
If the aesthetic is wrong, the root cause is almost always the IMAGES being sent, not the text.

MUTATION TYPES available:
- null_style_ref: Remove the style reference image entirely. Use when it's anchoring the wrong aesthetic.
- null_location_images: Remove all location reference images. Use when real room photos are making illustrations look like domestic scenes instead of what's intended.
- update_style_guide: Rewrite userNotes (the main style text prompt), artStyle, negativePrompt.
- update_spread_scene: Rewrite illustrationPrompt and/or mood for specific spreads. This is what Gemini actually reads as the scene direction.
- update_spread_summary: Rewrite sceneSummary for a spread (fallback used if no scene record).

DIAGNOSIS APPROACH:
1. Look at what images are being sent (style ref, locations) — these are the primary problem sources
2. Look at illustration_prompt content — is it describing the right thing?
3. Look at whether the scene summaries match the intended visual concept
4. Identify the 2-3 root causes, not symptoms

When writing new illustrationPrompt values, be extremely specific about:
- What occupies the MAJORITY of the frame
- What is in the FOREGROUND vs BACKGROUND
- Any UI/interface elements if the book has a device aesthetic
- What characters appear as (small thumbnails? main subjects?)
- The exact visual metaphor for the scene

OUTPUT FORMAT — return exactly these XML tags:
<assistant_reply>Your conversational response to the user</assistant_reply>
<style_overhaul_plan>
{valid JSON matching the schema below}
</style_overhaul_plan>

JSON schema:
{
  "diagnosis": ["root cause 1", "root cause 2"],
  "mutations": [
    {"type": "null_style_ref"},
    {"type": "null_location_images"},
    {"type": "update_style_guide", "fields": {"userNotes": "...", "negativePrompt": "..."}},
    {"type": "update_spread_scene", "spreadId": "uuid", "fields": {"illustrationPrompt": "...", "mood": "..."}},
    {"type": "update_spread_summary", "spreadId": "uuid", "sceneSummary": "..."}
  ],
  "sampleSpreadIndex": 1,
  "notesToUser": "Plain English summary of what will change",
  "readyForFullRedraw": true
}

Set readyForFullRedraw: true only when you have enough information to prescribe specific changes.
sampleSpreadIndex: pick the spread most representative of the style problem (1-based).
Only include mutations that are actually needed.
In assistant_reply: plain language, no technical jargon, no database terms.`;
}

async function applyMutations(storyId: string, mutations: StyleMutation[]) {
  for (const mutation of mutations) {
    switch (mutation.type) {
      case "update_style_guide": {
        const existing = await db.query.storyStyleGuide.findFirst({
          where: eq(storyStyleGuide.storyId, storyId),
        });
        const allowed = ["userNotes", "artStyle", "colorPalette", "negativePrompt", "sampleIllustrationUrl"];
        const update: Record<string, any> = { updatedAt: new Date() };
        for (const key of allowed) {
          if (mutation.fields[key] !== undefined) update[key] = mutation.fields[key];
        }
        if (existing) {
          await db.update(storyStyleGuide).set(update).where(eq(storyStyleGuide.storyId, storyId));
        } else {
          await db.insert(storyStyleGuide).values({ storyId, summary: mutation.fields.userNotes ?? "", ...update });
        }
        console.log("✅ Style guide updated");
        break;
      }
      case "update_spread_scene": {
        const allowed = ["illustrationPrompt", "mood", "compositionNotes"];
        const update: Record<string, any> = { updatedAt: new Date() };
        for (const key of allowed) {
          if ((mutation.fields as any)[key] !== undefined) update[key] = (mutation.fields as any)[key];
        }
        const existing = await db.query.storySpreadScene.findFirst({
          where: eq(storySpreadScene.spreadId, mutation.spreadId),
        });
        if (existing) {
          await db.update(storySpreadScene).set(update).where(eq(storySpreadScene.spreadId, mutation.spreadId));
          console.log(`✅ Spread scene updated: ${mutation.spreadId}`);
        } else {
          console.warn(`⚠️ No storySpreadScene record for spread ${mutation.spreadId} — skipping`);
        }
        break;
      }
      case "update_spread_summary": {
        await db
          .update(storySpreads)
          .set({ sceneSummary: mutation.sceneSummary })
          .where(eq(storySpreads.id, mutation.spreadId));
        console.log(`✅ Spread summary updated: ${mutation.spreadId}`);
        break;
      }
      case "null_location_images": {
        const locRows = await db
          .select({ id: locations.id })
          .from(storyLocations)
          .innerJoin(locations, eq(storyLocations.locationId, locations.id))
          .where(eq(storyLocations.storyId, storyId));
        if (locRows.length > 0) {
          await db
            .update(locations)
            .set({ portraitImageUrl: null, referenceImageUrl: null })
            .where(inArray(locations.id, locRows.map((l) => l.id)));
        }
        console.log("✅ Location images nulled");
        break;
      }
      case "null_style_ref": {
        await db
          .update(storyStyleGuide)
          .set({ sampleIllustrationUrl: null, updatedAt: new Date() })
          .where(eq(storyStyleGuide.storyId, storyId));
        console.log("✅ Style reference image nulled");
        break;
      }
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  try {
    const body = await req.json();
    const { messages, applyPlan } = body as { messages: Message[]; applyPlan?: StyleOverhaulPlan };

    if (applyPlan) {
      await applyMutations(storyId, applyPlan.mutations ?? []);
      return NextResponse.json({ success: true, mutationsApplied: applyPlan.mutations?.length ?? 0 });
    }

    if (!messages?.length) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const ctx = await loadStoryContext(storyId);
    const contextXml = buildContextXml(ctx);

    // Build image blocks — sample spread images first, then character portraits
    const imageBlocks: any[] = [];

    for (const spread of ctx.spreads.slice(0, 3)) {
      if (spread.sampleImageUrl) {
        imageBlocks.push({ type: "image", source: { type: "url", url: spread.sampleImageUrl } });
        imageBlocks.push({ type: "text", text: `↑ Current illustration: spread ${spread.spreadIndex}` });
      }
    }

    // Style reference image if it exists
    if (ctx.style?.sampleIllustrationUrl) {
      imageBlocks.push({ type: "image", source: { type: "url", url: ctx.style.sampleIllustrationUrl } });
      imageBlocks.push({ type: "text", text: "↑ CURRENT STYLE REFERENCE IMAGE — this is sent to Gemini and is the primary visual anchor" });
    }

    // Character portraits
    for (const char of ctx.chars.slice(0, 4)) {
      if (char.portraitUrl) {
        imageBlocks.push({ type: "image", source: { type: "url", url: char.portraitUrl } });
        imageBlocks.push({ type: "text", text: `↑ Character portrait: ${char.name}` });
      }
    }

    const userContent: any[] = [
      ...imageBlocks,
      {
        type: "text",
        text: [
          "Full story generation context:",
          contextXml,
          "",
          "Conversation:",
          messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n"),
          "",
          "Diagnose the style problem and produce your overhaul plan.",
        ].join("\n\n"),
      },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[style-overhaul] Anthropic error:", data);
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    const rawText = data.content
      ?.filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n") ?? "";

    const assistantReply = extractTaggedBlock(rawText, "assistant_reply") ?? rawText.trim();

    let plan: StyleOverhaulPlan | null = null;
    const planJson = extractTaggedBlock(rawText, "style_overhaul_plan");
    if (planJson) {
      try {
        plan = JSON.parse(planJson);
      } catch (e) {
        console.warn("[style-overhaul] Failed to parse plan JSON:", e);
      }
    }

    return NextResponse.json({
      assistantMessage: { id: `assistant-${Date.now()}`, role: "assistant", content: assistantReply },
      plan,
    });
  } catch (err: any) {
    console.error("[style-overhaul]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
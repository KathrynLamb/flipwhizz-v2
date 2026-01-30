// inngest/decideSpreadScenes.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  stories,
  storySpreads,
  storyPages,
  characters,
  locations,
  storyCharacters,
  storyLocations,
  storySpreadPresence,
  storySpreadScene,
  storyWorkflowProgress,
} from "@/db/schema";
import type { InferInsertModel } from "drizzle-orm";

import { eq, asc, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/* ======================================================
   CONFIG
====================================================== */

const MODEL = "claude-sonnet-4-5-20250929";
const BATCH_SIZE = 4;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

type SpreadDecision = z.infer<typeof SpreadDecisionSchema>;

/* ======================================================
   SCHEMA
====================================================== */

const SpreadDecisionSchema = z.object({
  spreadId: z.string(),

  presence: z.object({
    primaryLocationId: z.string().nullable(),

    characters: z.array(
      z.object({
        characterId: z.string(),
        role: z.enum(["primary", "secondary", "background"]),
        confidence: z.number().optional(),
        reason: z.string().optional(),
      })
    ),

    excludedCharacters: z.array(
      z.union([
        z.string(),
        z.object({
          characterId: z.string(),
          reason: z.string().optional(),
        })
      ])
    ).optional().default([]),

    reasoning: z.string().optional(),
  }),

  scene: z.object({
    sceneSummary: z.string(),
    illustrationPrompt: z.string(),
    compositionNotes: z.array(z.string()).optional().default([]),
    mood: z.string().optional(),
    doNotInclude: z.array(z.string()).optional().default([]),
    negativePrompt: z.string().optional(),
  }),
});

const ClaudeOutputSchema = z.object({
  spreads: z.array(SpreadDecisionSchema),
});

/* ======================================================
   HELPERS
====================================================== */

function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("\n")
    .trim();
}

function parseClaudeJson(raw: string): unknown {
  let clean = raw.trim();
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) clean = fenced[1].trim();
  
  try {
    return JSON.parse(clean);
  } catch (e) {
    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
      return JSON.parse(clean.slice(first, last + 1));
    }
    throw e;
  }
}

/* ======================================================
   INNGEST FUNCTION
====================================================== */

export const decideSpreadScenes = inngest.createFunction(
  {
    id: "decide-spread-scenes",
    retries: 1,
    concurrency: { limit: 1, key: "event.data.storyId" },
    timeouts: { start: "10m", finish: "20m" },
  },

  { event: "story/decide-spread-scenes" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🔵 [decide-spread-scenes] Starting for story:", storyId);

    /* --------------------------------------------------
       STEP 1: Check if already completed (idempotency)
    -------------------------------------------------- */

    const progress = await step.run("check-progress", async () => {
      return db.query.storyWorkflowProgress.findFirst({
        where: eq(storyWorkflowProgress.storyId, storyId),
      });
    });

    if (!progress) {
      throw new Error("Workflow progress not found");
    }

    if (progress.scenesDecided) {
      console.log("⏭️ [decide-spread-scenes] Already completed, skipping");
      return { ok: true, skipped: true };
    }

    if (!progress.spreadsBuilt) {
      throw new Error("Cannot decide scenes - spreads not built yet");
    }

    /* --------------------------------------------------
       STEP 2: Acquire lock
    -------------------------------------------------- */

    await step.run("acquire-lock", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({ decidingScenes: true, updatedAt: new Date() })
        .where(eq(storyWorkflowProgress.storyId, storyId));
    });

    /* --------------------------------------------------
       STEP 3: Load all data
    -------------------------------------------------- */

    const data = await step.run("load-world", async () => {
      const story = await db.query.stories.findFirst({ 
        where: eq(stories.id, storyId) 
      });
      if (!story) throw new Error("Story not found");

      const spreads = await db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        orderBy: asc(storySpreads.spreadIndex),
      });
      if (!spreads.length) throw new Error("No spreads found");

      const pages = await db.query.storyPages.findMany({ 
        where: eq(storyPages.storyId, storyId) 
      });

      const chars = await db.select({
          id: characters.id,
          name: characters.name,
          description: characters.description,
        }).from(storyCharacters)
        .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
        .where(eq(storyCharacters.storyId, storyId));

      const locs = await db.select({
          id: locations.id,
          name: locations.name,
          description: locations.description,
        }).from(storyLocations)
        .innerJoin(locations, eq(storyLocations.locationId, locations.id))
        .where(eq(storyLocations.storyId, storyId));

      return { story, spreads, pages, chars, locs };
    });

    console.log(`📊 [decide-spread-scenes] Loaded ${data.spreads.length} spreads, ${data.chars.length} characters, ${data.locs.length} locations`);

    const spreadsForClaude = data.spreads.map((s) => {
      const left = data.pages.find((p) => p.id === s.leftPageId);
      const right = data.pages.find((p) => p.id === s.rightPageId);
      return {
        spreadId: s.id,
        index: s.spreadIndex,
        text: `Left: ${left?.text || ""}\nRight: ${right?.text || ""}`
      };
    });

    /* --------------------------------------------------
       STEP 4: Process in batches with Claude
    -------------------------------------------------- */

    const batches = [];
    for (let i = 0; i < spreadsForClaude.length; i += BATCH_SIZE) {
        batches.push(spreadsForClaude.slice(i, i + BATCH_SIZE));
    }

    const allResults: SpreadDecision[] = [];

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        const batchResult = await step.run(`claude-batch-${i + 1}`, async () => {
            const exampleJson = JSON.stringify({
                spreads: [
                    {
                    spreadId: batch[0].spreadId,
                    presence: {
                        primaryLocationId: data.locs[0]?.id || "loc-1",
                        characters: [ { characterId: data.chars[0]?.id || "char-1", role: "primary" } ],
                        excludedCharacters: [],
                        reasoning: "Simple reasoning here."
                    },
                    scene: {
                        sceneSummary: "A bear walking in the woods.",
                        illustrationPrompt: "A wide shot of a bear walking...",
                        compositionNotes: ["Center the bear"],
                        mood: "Calm"
                    }
                    }
                ]
            }, null, 2);

            const systemPrompt = `
You are a layout engine for a children's book.
Your job is to determine WHICH characters and WHICH location appear on these specific spreads.

INPUTS:
1. List of Available Characters (with IDs)
2. List of Available Locations (with IDs)
3. List of Spreads (with IDs and Story Text)

OUTPUT:
Valid JSON object containing a "spreads" array.
Each item in the array MUST follow this structure EXACTLY:
${exampleJson}

RULES:
1. "spreadId" must match the input exactly.
2. "primaryLocationId" must be one of the provided Location IDs (or null).
3. "characters" list must use provided Character IDs.
4. **"role"** must be one of: "primary", "secondary", or "background".
5. Do NOT include markdown formatting.
            `.trim();

            const userPrompt = `
CHARACTERS:
${data.chars.map(c => `${c.name}: ${c.id}`).join("\n")}

LOCATIONS:
${data.locs.map(l => `${l.name}: ${l.id}`).join("\n")}

SPREADS TO PROCESS (Batch ${i + 1}/${batches.length}):
${JSON.stringify(batch, null, 2)}
            `.trim();

            const prefill = `{ "spreads": [`;
            
            const res = await anthropic.messages.create({
                model: MODEL,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                { role: "user", content: userPrompt },
                { role: "assistant", content: prefill }
                ],
            });

            const raw = prefill + extractClaudeText(res.content);
            console.log(`✅ [decide-spread-scenes] Batch ${i+1} complete`);
            
            const parsed = parseClaudeJson(raw);
            return ClaudeOutputSchema.parse(parsed);
        });

        allResults.push(...batchResult.spreads);
    }

    console.log(`✅ [decide-spread-scenes] Claude processed ${allResults.length} spreads`);

    /* --------------------------------------------------
       STEP 5: Persist scene data
    -------------------------------------------------- */

    await step.run("persist-scenes", async () => {
      await db.transaction(async (tx) => {
        const spreadIds = data.spreads.map((s) => s.id);
        
        if(spreadIds.length > 0) {
            await tx.delete(storySpreadPresence).where(inArray(storySpreadPresence.spreadId, spreadIds));
            await tx.delete(storySpreadScene).where(inArray(storySpreadScene.spreadId, spreadIds));
        }

        for (const s of allResults) {
          if (!spreadIds.includes(s.spreadId)) continue;

          const presenceRow: InferInsertModel<typeof storySpreadPresence> = {
            spreadId: s.spreadId,
            primaryLocationId: s.presence.primaryLocationId,
            characters: s.presence.characters.map(c => ({
              characterId: c.characterId,
              role: c.role === "background" ? "secondary" : c.role,
              confidence: c.confidence ?? 0.8,
              reason: c.reason ?? "Inferred by story context",
            })),
            excludedCharacters: (s.presence.excludedCharacters ?? []).map(ec => {
              if (typeof ec === 'string') {
                return {
                  characterId: ec,
                  reason: "Not present in this scene",
                };
              }
              return {
                characterId: ec.characterId,
                reason: ec.reason ?? "Not present in this scene",
              };
            }),
            reasoning: s.presence.reasoning ?? "",
            source: "claude",
            locked: false,
          };

          await tx.insert(storySpreadPresence).values(presenceRow);
          
          const sceneRow: InferInsertModel<typeof storySpreadScene> = {
            spreadId: s.spreadId,
            sceneSummary: s.scene.sceneSummary,
            illustrationPrompt: s.scene.illustrationPrompt,
            compositionNotes: s.scene.compositionNotes ?? [],
            mood: s.scene.mood,
            doNotInclude: s.scene.doNotInclude ?? [],
            negativePrompt: s.scene.negativePrompt,
            source: "claude",
            locked: false,
          };
          
          await tx.insert(storySpreadScene).values(sceneRow);
        }
      });
    });

    console.log("✅ [decide-spread-scenes] Scene data persisted");

    /* --------------------------------------------------
       STEP 6: Mark phase complete (FINAL PHASE)
    -------------------------------------------------- */

    await step.run("mark-complete", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          scenesDecided: true,
          scenesDecidedAt: new Date(),
          decidingScenes: false,
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      // Update story status to ready (optional - for backwards compatibility)
      await db
        .update(stories)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      console.log("✅ [decide-spread-scenes] ALL PHASES COMPLETE - Story ready!");
    });

    console.log(`🎉 [decide-spread-scenes] Complete: ${allResults.length} scenes decided`);

    return { 
      ok: true, 
      count: allResults.length,
      phase: "scenes_decided" 
    };
  }
);
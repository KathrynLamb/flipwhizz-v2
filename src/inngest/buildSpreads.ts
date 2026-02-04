// inngest/buildSpreads.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { 
  stories, 
  storyPages, 
  storySpreads,
  storyWorkflowProgress 
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const buildSpreads = inngest.createFunction(
  {
    id: "build-spreads",
    concurrency: { limit: 1, key: "event.data.storyId" },
    retries: 3,
  },
  { event: "story/build-spreads" },  // Keep object syntax
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🔵 [build-spreads] Starting for story:", storyId);

    /* --------------------------------------------------
       STEP 1: Check if already completed (idempotency)
    -------------------------------------------------- */

    const progress = await step.run("check-progress", async () => {
      return db.query.storyWorkflowProgress.findFirst({
        where: eq(storyWorkflowProgress.storyId, storyId),
      });
    });

    if (!progress) {
      throw new Error("Workflow progress not found - extract-world must run first");
    }

    if (progress.spreadsBuilt) {
      console.log("⏭️ [build-spreads] Already completed, skipping");
      
      // Still trigger next phase if scenes not decided
      if (!progress.scenesDecided) {
        await step.run("trigger-decide-scenes", async () => {
          await inngest.send({
            name: "story/decide-spread-scenes",
            data: { storyId },
          });
        });
      }
      
      return { ok: true, skipped: true };
    }

    if (!progress.worldExtracted) {
      throw new Error("Cannot build spreads - world not extracted yet");
    }

    /* --------------------------------------------------
       STEP 2: Acquire lock
    -------------------------------------------------- */

    await step.run("acquire-lock", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({ buildingSpreads: true, updatedAt: new Date() })
        .where(eq(storyWorkflowProgress.storyId, storyId));
    });

    /* --------------------------------------------------
       STEP 3: Load pages
    -------------------------------------------------- */

    const pages = await step.run("load-pages", async () => {
      return db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });
    });

    if (pages.length === 0) {
      throw new Error("No pages found for story");
    }

    console.log(`📄 [build-spreads] Loaded ${pages.length} pages`);

    /* --------------------------------------------------
       STEP 4: Check if spreads already exist in DB
    -------------------------------------------------- */

    const existing = await step.run("check-existing-spreads", async () => {
      return db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        limit: 1,
      });
    });

    if (existing.length > 0) {
      console.log("✅ [build-spreads] Spreads already exist in DB, marking complete");
      
      await db
        .update(storyWorkflowProgress)
        .set({
          spreadsBuilt: true,
          spreadsBuiltAt: new Date(),
          buildingSpreads: false,
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      await inngest.send({
        name: "story/decide-spread-scenes",
        data: { storyId },
      });
      
      return { ok: true, spreadsCreated: existing.length };
    }

    /* --------------------------------------------------
       STEP 5: Build spread pairs
    -------------------------------------------------- */

    const inserts: {
      id: string;
      storyId: string;
      spreadIndex: number;
      leftPageId: string;
      rightPageId: string | null;
    }[] = [];
    
    let spreadIndex = 1;

    for (let i = 0; i < pages.length; i += 2) {
      inserts.push({
        id: uuid(),
        storyId,
        spreadIndex,
        leftPageId: pages[i].id,
        rightPageId: pages[i + 1]?.id ?? null,
      });
      spreadIndex++;
    }

    console.log(`📚 [build-spreads] Creating ${inserts.length} spreads`);

    /* --------------------------------------------------
       STEP 6: Insert spreads into database
    -------------------------------------------------- */

    await step.run("insert-spreads", async () => {
      if (inserts.length > 0) {
        await db.insert(storySpreads).values(inserts);
      }
    });

    console.log("✅ [build-spreads] Spreads inserted into database");

    /* --------------------------------------------------
       STEP 7: Mark phase complete and trigger next phase
    -------------------------------------------------- */

    await step.run("mark-complete-and-trigger-next", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          spreadsBuilt: true,
          spreadsBuiltAt: new Date(),
          buildingSpreads: false,
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      console.log("✅ [build-spreads] Phase complete, triggering decide-spread-scenes");

      await inngest.send({
        name: "story/decide-spread-scenes",
        data: { storyId },
      });
    });

    console.log(`🎉 [build-spreads] Complete: ${inserts.length} spreads created`);

    return {
      ok: true,
      spreadsCreated: inserts.length,
      phase: "spreads_built",
    };
  }
);
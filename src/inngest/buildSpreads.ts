// src/inngest/buildSpreads.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storyPages,
  storySpreads,
  storyWorkflowProgress,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const buildSpreads = inngest.createFunction(
  {
    id: "build-spreads",
    retries: 2,
  },
  { event: "story/build-spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🔵 [build-spreads] Starting for story:", storyId);

    /* --------------------------------------------------
       STEP 1: Load pages
    -------------------------------------------------- */
    const pages = await step.run("load-pages", async () => {
      return db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });
    });

    if (pages.length === 0) {
      throw new Error("No pages found");
    }

    /* --------------------------------------------------
       STEP 2: Build spread pairs
    -------------------------------------------------- */
    const spreads = await step.run("create-spreads", async () => {
      const inserts = [];
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

      await db.insert(storySpreads).values(inserts);
      return inserts.length;
    });

    console.log(`✅ [build-spreads] Created ${spreads} spreads`);

    /* --------------------------------------------------
       STEP 3: Mark complete and trigger next phase
    -------------------------------------------------- */
    await step.run("mark-complete-and-trigger-next", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          spreadsBuilt: true,
          spreadsBuiltAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      console.log("✅ [build-spreads] Complete, triggering decide-scenes");

      await inngest.send({
        name: "story/decide-scenes",
        data: { storyId },
      });
    });

    return { ok: true, spreadsCreated: spreads };
  }
);
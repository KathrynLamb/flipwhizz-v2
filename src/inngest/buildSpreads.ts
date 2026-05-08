// src/inngest/buildSpreads.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storyPages,
  storySpreads,
  storyWorkflowProgress,
} from "@/db/schema";
import { eq, asc, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const buildSpreads = inngest.createFunction(
  {
    id: "build-spreads",
    retries: 2,
    triggers: [{ event: "story/build-spreads" }],
  },
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
    const spreadsCreated = await step.run("create-spreads", async () => {
      const inserts = [];
      let spreadIndex = 1;

      for (let i = 0; i < pages.length; i += 2) {
        inserts.push({
          id: uuid(),
          storyId,
          spreadIndex,
          leftPageId: pages[i].id,
          rightPageId: pages[i + 1]?.id ?? null,
          createdAt: new Date(),
        });
        spreadIndex++;
      }

      await db.insert(storySpreads).values(inserts).onConflictDoNothing();
      return inserts.length;
    });

    console.log(`✅ [build-spreads] Created ${spreadsCreated} spreads`);

    /* --------------------------------------------------
       STEP 3: Validate page IDs were linked
    -------------------------------------------------- */
    await step.run("validate-spread-page-ids", async () => {
      const nullSpreads = await db
        .select({
          spreadIndex: storySpreads.spreadIndex,
        })
        .from(storySpreads)
        .where(
          and(
            eq(storySpreads.storyId, storyId),
            sql`${storySpreads.leftPageId} IS NULL`
          )
        );

      if (nullSpreads.length > 0) {
        throw new Error(
          `Spread build failed: ${nullSpreads.length} spread(s) have null leftPageId ` +
            `(indices: ${nullSpreads.map((s) => s.spreadIndex).join(", ")}). ` +
            `Pages may not have been saved before spread building ran.`
        );
      }

      console.log(`✅ All ${spreadsCreated} spreads have valid page IDs`);
    });

    /* --------------------------------------------------
       STEP 4: Mark complete and trigger next phase
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
        name: "story/decide-spread-scenes",
        data: { storyId },
      });
    });

    return { ok: true, spreadsCreated };
  }
);
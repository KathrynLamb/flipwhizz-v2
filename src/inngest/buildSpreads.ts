import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { stories, storyPages, storySpreads } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const buildSpreads = inngest.createFunction(
  {
    id: "build-spreads",
    concurrency: { limit: 1, key: "event.data.storyId" },
    retries: 3,
  },
  { event: "story/build-spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    try {
      // 1️⃣ Load pages
      const pages = await step.run("load-pages", async () => {
        return db.query.storyPages.findMany({
          where: eq(storyPages.storyId, storyId),
          orderBy: asc(storyPages.pageNumber),
        });
      });

      if (pages.length === 0) {
        // Mark as failed in DB
        await db
          .update(stories)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
        throw new Error("No pages found for story");
      }

      // 2️⃣ Idempotency: if spreads already exist, mark as ready and stop
      const existing = await step.run("check-existing", async () => {
        return db.query.storySpreads.findMany({
          where: eq(storySpreads.storyId, storyId),
          limit: 1,
        });
      });

      if (existing.length > 0) {
        // Spreads already exist, ensure story is marked ready
        await db
          .update(stories)
          .set({ status: "spreads_ready", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
        
        return { ok: true, skipped: true, message: "Spreads already exist" };
      }

      // 3️⃣ Build spreads (page pairs)
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

      // 4️⃣ Insert spreads
      await step.run("insert-spreads", async () => {
        if (inserts.length > 0) {
          await db.insert(storySpreads).values(inserts);
        }
      });

      // 5️⃣ Update story status to spreads_ready
      await step.run("update-story-status", async () => {
        await db
          .update(stories)
          .set({ status: "spreads_ready", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      });

      console.log(`✅ [build-spreads] Created ${inserts.length} spreads for story ${storyId}`);

      return {
        ok: true,
        spreadsCreated: inserts.length,
        status: "spreads_ready",
      };
    } catch (error) {
      console.error(`❌ [build-spreads] Error for story ${storyId}:`, error);
      
      // Mark story as error state
      try {
        await db
          .update(stories)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      } catch (updateError) {
        console.error(`❌ [build-spreads] Failed to update error status:`, updateError);
      }

      throw error; // Re-throw to let Inngest handle retries
    }
  }
);
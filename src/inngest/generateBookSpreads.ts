import { inngest } from "./client";
import { eq, asc } from "drizzle-orm";
import { storyPages } from "@/db/schema";
import { db } from "@/db";

export const generateBookSpreads = inngest.createFunction(
  { id: "generate-book-spreads", concurrency: 5, retries: 2 },
  { event: "story/generate.spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    if (!storyId) throw new Error("storyId required");

    const pages = await step.run("fetch-pages", async () =>
      db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
        columns: { id: true, pageNumber: true },
      })
    );

    const events = [];

    for (let i = 0; i < pages.length; i += 2) {
      const left = pages[i];
      const right = pages[i + 1] ?? null;

      events.push({
        name: "story/generate.single.spread",
        data: {
          storyId,
          leftPageId: left.id,
          rightPageId: right?.id ?? null,
          pageLabel: `${left.pageNumber}-${right?.pageNumber ?? "end"}`,
        },
      });
    }

    if (events.length) {
      await step.sendEvent("dispatch-spreads", events);
    }

    return { spreadsQueued: events.length };
  }
);

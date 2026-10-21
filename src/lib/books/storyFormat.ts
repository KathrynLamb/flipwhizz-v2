import { db } from "@/db";
import { stories, readers, storySpreads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { COLOURING_STYLE, normalizeBookType, isSpreadRenderMode, type SpreadRenderMode } from "./bookType";

export type StoryFormatOptions = {
  /** Look up the render mode of the spread that starts on this page. */
  leftPageId?: string | null;
};

export async function getStoryFormat(storyId: string, opts: StoryFormatOptions = {}) {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!story) throw new Error("Story not found");
  const bookType = normalizeBookType(story.bookType);
  const reader = story.readerId ? await db.query.readers.findFirst({ where: eq(readers.id, story.readerId) }) : null;

  // Storybooks are always colour. Colouring books are outline unless this spread says otherwise.
  let renderMode: SpreadRenderMode = bookType === "colouring_storybook" ? "outline" : "colour";
  if (bookType === "colouring_storybook" && opts.leftPageId) {
    const spread = await db.query.storySpreads.findFirst({
      where: eq(storySpreads.leftPageId, opts.leftPageId),
      columns: { renderMode: true },
    });
    if (isSpreadRenderMode(spread?.renderMode)) renderMode = spread.renderMode;
  }

  const outline = bookType === "colouring_storybook" && renderMode === "outline";
  return {
    bookType,
    renderMode,
    confirmed: bookType !== "colouring_storybook" || Boolean(story.bookTypeConfirmedAt),
    /** Empty for storybooks and for colour spreads, so callers fall back to the story's normal style. */
    interiorStyle: outline ? `${COLOURING_STYLE}\n${reader?.age ? `Reader age: ${reader.age}.` : "Use generous spaces suitable for young children."}` : "",
  };
}
export async function requireConfirmedBookType(storyId: string, opts: StoryFormatOptions = {}) {
  const format = await getStoryFormat(storyId, opts);
  if (!format.confirmed) throw new Error("Confirm your colouring storybook format before generating illustrations.");
  return format;
}

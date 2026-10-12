import { db } from "@/db";
import { stories, readers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { COLOURING_STYLE, normalizeBookType } from "./bookType";

export async function getStoryFormat(storyId: string) {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!story) throw new Error("Story not found");
  const bookType = normalizeBookType(story.bookType);
  const reader = story.readerId ? await db.query.readers.findFirst({ where: eq(readers.id, story.readerId) }) : null;
  return {
    bookType,
    confirmed: bookType !== "colouring_storybook" || Boolean(story.bookTypeConfirmedAt),
    interiorStyle: bookType === "colouring_storybook" ? `${COLOURING_STYLE}\n${reader?.age ? `Reader age: ${reader.age}.` : "Use generous spaces suitable for young children."}` : "",
  };
}
export async function requireConfirmedBookType(storyId: string) {
  const format = await getStoryFormat(storyId);
  if (!format.confirmed) throw new Error("Confirm your colouring storybook format before generating illustrations.");
  return format;
}

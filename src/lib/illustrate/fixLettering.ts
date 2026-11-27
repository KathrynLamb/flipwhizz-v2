// src/lib/illustrate/fixLettering.ts
//
// "Fix lettering only" (admin): correct a spread's words or punctuation
// without redrawing the picture.
//
// 1. Read the lettering on the current picture, and where it is.
// 2. Re-letter a copy with the story text (plus an optional admin note).
// 3. Paste ONLY the text areas (old and new) back onto the current picture,
//    so faces, characters and background stay exactly as they were.
// 4. Read the result back and judge words AND quote marks.
// 5. Save only if it's right, or clearly better than before. Otherwise the
//    page is left alone and the reason comes back.
//
// Runs inline from the admin action (about a minute). The admin route takes
// a snapshot first, so a saved fix can be undone from Activity.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { storyPages, storySpreads, storyStyleGuide } from "@/db/schema";
import { getStoryFormat } from "@/lib/books/storyFormat";
import { resolveStyleGuide } from "@/inngest/generateBookSpreads";
import { compositeText, judge, letterArt, readText } from "./checkfix";
import { fetchImage, upload } from "./images";
import { LETTERING_MODEL, SPREAD_IMAGE_SIZE } from "./models";
import type { TextBlock, TextVerdict } from "./geometry";

const ASPECT = "16:9";
const PLAIN_TYPOGRAPHY =
  "Plain legible black lettering on pure white. No colour, decorative shading or coloured panels. Preserve all outline artwork as black lines on white.";

export type FixLetteringResult =
  | { saved: true; url: string; before: TextVerdict; after: TextVerdict }
  | { saved: false; reason: string; before?: TextVerdict; after?: TextVerdict };

/** Fewer problems wins; ties go to the closer words. */
function better(after: TextVerdict, before: TextVerdict): boolean {
  if (after.ok) return true;
  if (after.problems.length !== before.problems.length) return after.problems.length < before.problems.length;
  return after.left + after.right > before.left + before.right + 0.01;
}

export async function fixLetteringOnly(args: { storyId: string; spreadId: string; note?: string | null }): Promise<FixLetteringResult> {
  const { storyId, spreadId } = args;
  const spread = await db.query.storySpreads.findFirst({ where: and(eq(storySpreads.id, spreadId), eq(storySpreads.storyId, storyId)) });
  if (!spread?.leftPageId) return { saved: false, reason: "That spread isn't in this book." };
  const pageIds = [spread.leftPageId, ...(spread.rightPageId ? [spread.rightPageId] : [])];
  const pages = await db
    .select({ id: storyPages.id, text: storyPages.text, imageUrl: storyPages.imageUrl })
    .from(storyPages)
    .where(inArray(storyPages.id, pageIds));
  const left = pages.find((p) => p.id === spread.leftPageId);
  const right = spread.rightPageId ? pages.find((p) => p.id === spread.rightPageId) : null;
  const leftText = left?.text ?? "";
  const rightText = right?.text ?? "";
  const currentUrl = left?.imageUrl;
  if (!currentUrl || currentUrl.startsWith("data:")) return { saved: false, reason: "This spread has no picture yet." };
  if (!leftText.trim() && !rightText.trim()) return { saved: false, reason: "This spread has no text to letter." };

  const format = await getStoryFormat(storyId, { leftPageId: spread.leftPageId });
  const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });
  const typography = format.interiorStyle ? PLAIN_TYPOGRAPHY : resolveStyleGuide(style).typographyBlock;

  // 1. What's lettered now
  const art = await fetchImage(currentUrl);
  const beforeBlocks: TextBlock[] = await readText(art);
  const before = judge(beforeBlocks, leftText, rightText);
  if (before.ok && !args.note?.trim()) {
    return { saved: false, reason: "The lettering already matches the story (words and quote marks). Add a note if something else needs changing.", before };
  }

  // 2. Re-letter a copy
  const feedback = [args.note?.trim(), ...before.problems].filter(Boolean).join("; ");
  const lettered = await letterArt({
    art,
    leftText,
    rightText,
    typography,
    aspectRatio: ASPECT,
    imageSize: SPREAD_IMAGE_SIZE,
    feedback,
    model: LETTERING_MODEL,
    replaceExisting: true,
  });

  // 3. Paste only the text areas (where text was before AND after) onto the current picture
  const afterLetterBlocks = await readText(lettered);
  const composed = await compositeText(art, lettered, [...beforeBlocks, ...afterLetterBlocks]);

  // 4. Judge what would actually be saved
  const afterBlocks = await readText(composed);
  const after = judge(afterBlocks, leftText, rightText);
  if (!better(after, before)) {
    return { saved: false, reason: `The new lettering wasn't better (${after.problems.join("; ") || "no change"}). Nothing was changed.`, before, after };
  }

  // 5. Save: both pages and the spread's QA record. latestRun moves on, so an
  // older drawing still running for this spread can't overwrite the fix.
  const url = await upload(composed, `flipwhizz/stories/${storyId}/work`);
  const now = Date.now();
  const qa = (spread.qa && typeof spread.qa === "object" ? spread.qa : {}) as Record<string, unknown>;
  const characters = typeof qa.characters === "string" ? qa.characters : null;
  const status = characters === "flagged" || !after.ok ? "flagged" : characters === "unchecked" ? "unchecked" : (characters ?? "ok");
  const record = {
    ...qa,
    status,
    finalUrl: url,
    text: { ...after, attempts: 1, method: "lettering fixed by admin" },
    textBlocks: afterBlocks,
    latestRun: now,
    savedRun: now,
    at: new Date(now).toISOString(),
  };
  await db.transaction(async (tx) => {
    await tx.update(storySpreads).set({ qa: record }).where(eq(storySpreads.id, spreadId));
    await tx.update(storyPages).set({ imageUrl: url }).where(inArray(storyPages.id, pageIds));
  });
  return { saved: true, url, before, after };
}

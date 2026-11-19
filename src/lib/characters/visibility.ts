// src/lib/characters/visibility.ts
//
// Characters that are in a story but not drawn (story_characters.shown).
//
// - The scene planner (src/inngest/decideSpreadScenes.ts) never puts a
//   not-shown character on a spread, and marks a character not shown when it
//   puts them on no spread at all (shownSource "auto"), unless the customer or
//   an admin decided otherwise.
// - Not-shown characters need no card (src/lib/characters/readiness.ts).
// - "Show this character" (customer chat or admin) sets shown = true with an
//   appearanceNote saying how and where, then replans the scenes. Spreads that
//   already have a picture and now include the character are redrawn once the
//   character has a card (src/inngest/buildSpreadPrompts.ts).

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { storyCharacters, storySpreadPresence, storySpreads } from "@/db/schema";
import { inngest } from "@/inngest/client";

export type VisibilitySource = "auto" | "customer" | "admin";

import { presenceCast, withoutCharacter } from "./visibilityRules";
export { withoutCharacter, charactersToAutoHide, presenceCast } from "./visibilityRules";

/** Set whether a character is drawn in this book. Hiding also takes them off every planned spread. */
export async function setCharacterShown(args: {
  storyId: string;
  characterId: string;
  shown: boolean;
  source: VisibilitySource;
  /** How and where to show them. Omit to keep the current note; null clears it. */
  note?: string | null;
}): Promise<{ ok: boolean }> {
  const set: Partial<typeof storyCharacters.$inferInsert> = { shown: args.shown, shownSource: args.source };
  if (args.note !== undefined) set.appearanceNote = args.note?.trim() ? args.note.trim().slice(0, 1000) : null;

  const updated = await db
    .update(storyCharacters)
    .set(set)
    .where(and(eq(storyCharacters.storyId, args.storyId), eq(storyCharacters.characterId, args.characterId)))
    .returning({ id: storyCharacters.characterId });
  if (updated.length === 0) return { ok: false };

  if (!args.shown) {
    const spreads = await db.select({ id: storySpreads.id }).from(storySpreads).where(eq(storySpreads.storyId, args.storyId));
    if (spreads.length) {
      const rows = await db
        .select({ id: storySpreadPresence.id, characters: storySpreadPresence.characters })
        .from(storySpreadPresence)
        .where(inArray(storySpreadPresence.spreadId, spreads.map((s) => s.id)));
      for (const r of rows) {
        const cast = presenceCast(r.characters);
        const next = withoutCharacter(cast, args.characterId);
        if (next.length !== cast.length) {
          await db
            .update(storySpreadPresence)
            .set({ characters: next as typeof r.characters, updatedAt: new Date() })
            .where(eq(storySpreadPresence.id, r.id));
        }
      }
    }
  }
  return { ok: true };
}

/** Save how to show a character without changing whether they are shown yet (the chat's result). */
export async function setAppearanceNote(storyId: string, characterId: string, note: string): Promise<boolean> {
  const r = await db
    .update(storyCharacters)
    .set({ appearanceNote: note.trim().slice(0, 1000) })
    .where(and(eq(storyCharacters.storyId, storyId), eq(storyCharacters.characterId, characterId)))
    .returning({ id: storyCharacters.characterId });
  return r.length > 0;
}

/**
 * Re-plan every spread (who is in each picture) and rebuild the briefs.
 * With redrawForCharacterId, spreads that already have a picture and now
 * include that character are redrawn at the end, if the character has a card.
 */
export async function replanScenes(storyId: string, opts: { redrawForCharacterId?: string | null; reason: string }) {
  await inngest.send({
    name: "story/decide-spread-scenes",
    data: {
      storyId,
      ...(opts.redrawForCharacterId ? { redrawForCharacterId: opts.redrawForCharacterId } : {}),
      replanReason: opts.reason,
    },
  });
}

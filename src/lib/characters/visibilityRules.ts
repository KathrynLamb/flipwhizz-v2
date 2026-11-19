// src/lib/characters/visibilityRules.ts
//
// The pure rules behind story_characters.shown (no database, so they can be
// unit tested: tests/character-visibility.test.ts). See ./visibility.ts.

export type PresenceCharacter = { characterId: string; role?: string; [k: string]: unknown };

/** Remove one character from a spread's planned cast. Pure, tested. */
export function withoutCharacter<T extends PresenceCharacter>(cast: T[] | null | undefined, characterId: string): T[] {
  return (cast ?? []).filter((c) => c.characterId !== characterId);
}

/**
 * Characters the planner left off every spread, which should now be marked
 * not shown. Characters a person decided about are left alone. Pure, tested.
 */
export function charactersToAutoHide(
  storyCast: Array<{ characterId: string; shown: boolean; shownSource: string | null }>,
  plannedIds: Set<string>,
): string[] {
  // A plan with nobody on it is a broken plan, not a book with no characters.
  if (plannedIds.size === 0) return [];
  return storyCast
    .filter((c) => c.shown && (c.shownSource === null || c.shownSource === "auto") && !plannedIds.has(c.characterId))
    .map((c) => c.characterId);
}

/**
 * A spread's planned cast as a list. Some older rows hold JSON null or a
 * JSON-encoded string instead of a list; never throw on those. Pure, tested.
 */
export function presenceCast(value: unknown): PresenceCharacter[] {
  let v = value;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  return Array.isArray(v) ? (v.filter((c) => c && typeof c === "object" && typeof (c as PresenceCharacter).characterId === "string") as PresenceCharacter[]) : [];
}

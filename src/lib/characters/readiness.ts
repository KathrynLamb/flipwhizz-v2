// src/lib/characters/readiness.ts
export type AppearanceState = {
  portraitImageUrl?: string | null;
  locked: boolean;
  /** Characters only: false = in the story but never drawn, so no card is needed. Locations leave it unset. */
  shown?: boolean | null;
};

export function hasPortrait(character: AppearanceState): boolean {
  const url = character.portraitImageUrl?.trim();
  return Boolean(url && /^https?:\/\//.test(url));
}

export function isAppearanceApproved(character: AppearanceState): boolean {
  return hasPortrait(character) && character.locked;
}

/** True unless explicitly marked as not drawn. */
export function isShown(character: AppearanceState): boolean {
  return character.shown !== false;
}

/** Every character that is drawn has an approved card (and at least one is drawn). */
export function isCastReady(characters: AppearanceState[]): boolean {
  const drawn = characters.filter(isShown);
  return drawn.length > 0 && drawn.every(isAppearanceApproved);
}

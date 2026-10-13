export type AppearanceState = {
  portraitImageUrl?: string | null;
  locked: boolean;
};

export function hasPortrait(character: AppearanceState): boolean {
  const url = character.portraitImageUrl?.trim();
  return Boolean(url && /^https?:\/\//.test(url));
}

export function isAppearanceApproved(character: AppearanceState): boolean {
  return hasPortrait(character) && character.locked;
}

export function isCastReady(characters: AppearanceState[]): boolean {
  return characters.length > 0 && characters.every(isAppearanceApproved);
}

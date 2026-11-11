// src/lib/characters/userEdits.ts
//
// When a parent edits a character's appearance after uploading a photo,
// PATCH /api/characters/[id] sets visualDetails.userEditedTraits = true
// (a new photo upload clears it). From then on the parent's written
// appearance beats the photo for anything it states (e.g. "blonde hair"),
// and the photo is only used for likeness. Every prompt that shows the AI
// the real photo must respect this, or pages drift back to the photo.

export function hasUserEditedTraits(visualDetails: unknown): boolean {
  return !!(visualDetails as Record<string, any> | null)?.userEditedTraits;
}

export const PARENT_TEXT_WINS =
  "The parent has corrected this character's written appearance. Where the written appearance and the photo disagree (hair colour, eye colour, skin tone, hair length or style), the WRITTEN APPEARANCE WINS. Use the photo for face shape and likeness only.";

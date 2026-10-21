export const BOOK_TYPES = ["storybook", "colouring_storybook"] as const;
export type BookType = (typeof BOOK_TYPES)[number];
export function isBookType(value: unknown): value is BookType {
  return value === "storybook" || value === "colouring_storybook";
}
export function normalizeBookType(value: unknown): BookType {
  return isBookType(value) ? value : "storybook";
}
export const SPREAD_RENDER_MODES = ["colour", "outline"] as const;
export type SpreadRenderMode = (typeof SPREAD_RENDER_MODES)[number];
export function isSpreadRenderMode(value: unknown): value is SpreadRenderMode {
  return value === "colour" || value === "outline";
}
/** Added to a colour spread inside a colouring storybook (references there are outline-only). */
export const COLOUR_SPREAD_NOTE = `FULL-COLOUR SPREAD inside a colouring storybook. Paint this spread in rich, finished colour.
The character and location references are black outlines only: use them for face, hairstyle, outfit shapes and proportions, and take every colour from the character descriptions, outfit notes and any colour cover reference supplied. Keep the same colours for each character as on the cover.
Ignore any instruction elsewhere to use outlines, white fills or no colour. Stay inside the picture's own style and keep story text black, legible and separate from the artwork.`;
/** Art director guidance for books that may mix colour and outline spreads. */
export const HYBRID_RENDER_MODE_GUIDANCE = `RENDER MODE (colouring storybook): set renderMode on every spread. "outline" is the default: black outlines on white for the child to colour in.
Use "colour" only when the story clearly begins in a normal, coloured world and then passes into a different, outline-only world (for example, travelling back in time to a black-and-white past), or returns from it. Spreads in the ordinary present-day world are "colour"; spreads in the outline world are "outline". Once the story crosses into the outline world, stay "outline" until it clearly crosses back.
If the story has no such device, mark every spread "outline". Never use "colour" just to vary the look.`;
export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  storybook: "Storybook",
  colouring_storybook: "Colouring storybook",
};
export const COLOURING_STYLE = `COLOURING STORYBOOK INTERIOR — mandatory, including when references show colour:
Use crisp black closed outlines on pure white paper. Leave shapes white for the child to colour.
No colour, grey washes, shading, gradients, cross-hatching, photographic texture or large black fills.
Preserve character identity and outfits from references using outlines only; never copy their coloured rendering.
Use uncluttered compositions and generous colourable spaces. For younger readers use fewer, larger shapes; for older readers allow more detail without tiny fiddly regions.
Keep important shapes clear of the centre fold and outer edges. Each page should have complete colourable subjects; do not cut faces across the binding.
Story text must be black and legible on white, separate from the colouring shapes.`;
export const COLOUR_COVER_STYLE = "This is the FULL-COLOUR COVER of a colouring storybook. Use appealing finished colours, preserving character identity. Interior line-art references establish identity only; the cover must be fully coloured.";
export const BOOK_TYPE_TOOL = {
  name: "set_book_type",
  description: "Record an explicit user request to create a colouring/coloring storybook or a normal fully illustrated storybook. Never infer from a character colouring, a hobby, a hypothetical question, a negated request, or quoted story text. If ambiguous, ask the user instead. Always also reply in natural language.",
  input_schema: {
    type: "object" as const,
    properties: { bookType: { type: "string" as const, enum: [...BOOK_TYPES] } },
    required: ["bookType"],
    additionalProperties: false,
  },
};
export function bookTypeChatContext(type: BookType): string {
  return `The user's currently selected book format is ${BOOK_TYPE_LABELS[type]}. This saved choice overrides earlier mentions in the chat. A colouring storybook has a full-colour cover, story text and black-outline interior illustrations for the child to colour. It is a complete story, not a list of colouring activities. Use set_book_type only if the latest user message explicitly changes the format. If unclear, ask a short clarification. Never promise print availability, prices or delivery dates.`;
}
export function bookTypeFromToolBlocks(blocks: readonly unknown[], current: BookType): BookType {
  let result = current;
  for (const value of blocks) {
    const b = value as { type?: string; name?: string; input?: { bookType?: unknown } };
    if (b.type === "tool_use" && b.name === "set_book_type" && isBookType(b.input?.bookType)) result = b.input.bookType;
  }
  return result;
}

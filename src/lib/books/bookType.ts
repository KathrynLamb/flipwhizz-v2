export const BOOK_TYPES = ["storybook", "colouring_storybook"] as const;
export type BookType = (typeof BOOK_TYPES)[number];
export function isBookType(value: unknown): value is BookType {
  return value === "storybook" || value === "colouring_storybook";
}
export function normalizeBookType(value: unknown): BookType {
  return isBookType(value) ? value : "storybook";
}
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

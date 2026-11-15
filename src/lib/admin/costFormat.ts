// src/lib/admin/costFormat.ts
//
// Formatting for AI costs on admin pages. Kept apart from costs.ts so client
// components can use it without pulling in the database.

/** "£1.23" or "45.6p", from micro-dollars. */
export function gbp(microUsd: number, usdToGbp: number): string {
  const v = (microUsd / 1_000_000) * usdToGbp;
  return v < 1 ? `${(v * 100).toFixed(1)}p` : `£${v.toFixed(2)}`;
}

/** "$1.56", from micro-dollars. */
export function usd(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(2)}`;
}

/** Plain names for the ai_usage kinds. */
export const KIND_LABELS: Record<string, string> = {
  character_card: "Character cards",
  character_full_body: "Character full bodies",
  location_card: "Place cards",
  characters: "Other character work (photos, outfits)",
  spread: "Spreads",
  world: "World building and reference sheets",
  style: "Style plate",
  planning: "Scene planning and prompts",
  cover: "Cover",
  writing: "Story writing and rewrites",
  other: "Other",
};

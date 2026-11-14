// src/lib/ai/pricing.ts
//
// What one Gemini call costs, worked out from the model, the image size and
// the token counts Google returns. List prices from Google's pricing page,
// checked 14 Nov 2026. Standard (not Batch) rates, in US dollars.
//
// Costs are kept as whole micro-dollars (1,000,000 = $1) so they add up
// exactly in the database. This is an estimate for tracking, not an invoice:
// the real bill is in pounds and Google's own numbers win.

export type CallUsage = {
  model: string;
  image: boolean;
  imageSize?: string | null;
  imagesOut?: number | null;
  promptTokens?: number | null;
  outputTokens?: number | null;
  thoughtTokens?: number | null;
};

type Rates = {
  /** $ per 1M input tokens (text and images). */
  input: number;
  /** $ per 1M text and thinking output tokens. */
  output: number;
  /** $ per generated image, by size. Image models only. */
  perImage?: Record<string, number>;
};

// Longest prefix wins, so put specific ids before general ones.
const RATES: Array<[prefix: string, rates: Rates]> = [
  ["gemini-nano-banana-2.1", { input: 1.5, output: 7.5, perImage: { "1K": 0.0336, "2K": 0.0504, "4K": 0.113 } }],
  ["gemini-3-pro-image", { input: 2.0, output: 12.0, perImage: { "1K": 0.134, "2K": 0.134, "4K": 0.24 } }],
  ["gemini-3.1-flash-lite-image", { input: 0.25, output: 1.5, perImage: { "1K": 0.0336 } }],
  ["gemini-3.1-flash-image", { input: 0.5, output: 3.0, perImage: { "1K": 0.067, "2K": 0.101, "4K": 0.151 } }],
  // 3.8 Flash is $0.75 / $3.75 until 31 Dec 2026, then $1.50 / $7.50.
  ["gemini-3.8-flash", { input: 0.75, output: 3.75 }],
  ["gemini-4-hydrogen", { input: 1.5, output: 7.5 }],
  ["gemini-2.5-flash", { input: 0.3, output: 2.5 }],
];

export function ratesFor(model: string): Rates | null {
  const hit = RATES.filter(([prefix]) => model.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}

/** Cost of one call in micro-dollars, or null when the model has no price here. */
export function costMicroUsd(u: CallUsage): number | null {
  const r = ratesFor(u.model);
  if (!r) return null;
  const perToken = (tokens: number | null | undefined, per1M: number) => ((tokens ?? 0) * per1M) / 1_000_000;

  let usd = perToken(u.promptTokens, r.input) + perToken(u.thoughtTokens, r.output);
  if (u.image && r.perImage) {
    // Images are billed per image by size; their tokens are not billed again.
    const size = (u.imageSize ?? "1K").toUpperCase();
    const each = r.perImage[size] ?? r.perImage["1K"] ?? 0;
    usd += each * (u.imagesOut ?? 0);
  } else {
    usd += perToken(u.outputTokens, r.output);
  }
  return Math.round(usd * 1_000_000);
}

/** Pounds per dollar for reports. Set FW_USD_TO_GBP to match your billing. */
export const USD_TO_GBP = Number(process.env.FW_USD_TO_GBP) || 0.79;

export function formatUsd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(micro < 10_000 ? 4 : 2)}`;
}

export function formatGbp(micro: number): string {
  const gbp = (micro / 1_000_000) * USD_TO_GBP;
  return gbp < 1 ? `${(gbp * 100).toFixed(1)}p` : `£${gbp.toFixed(2)}`;
}

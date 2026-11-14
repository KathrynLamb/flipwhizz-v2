// src/lib/illustrate/models.ts
//
// Every model id in one place. Checked against Google's pages on 7 Oct 2026:
// - The old Pro preview id (gemini-3-pro-image + "-preview") was shut down
//   25 Jun 2026; its replacement is gemini-3-pro-image. Never use preview ids.
// - gemini-nano-banana-2.1 (6 Oct 2026) scores higher than Pro on Google's
//   multi-character consistency eval (1106 vs 1011) and costs less; Pro is
//   stronger at long paragraphs of lettering.
// - Character reference limits: 2.1 "up to 4 images of characters", Pro
//   "up to 5". 14 input images in total.
// Override any id with an env var without a code change.

export type ArtModelKey = "nb21" | "pro";

export type ArtModel = {
  key: ArtModelKey;
  id: string;
  label: string;
  maxCharacterImages: number;
  maxInputImages: number;
};

export const ART_MODELS: Record<ArtModelKey, ArtModel> = {
  nb21: {
    key: "nb21",
    id: process.env.FW_MODEL_NB21 || "gemini-nano-banana-2.1",
    label: "Nano Banana 2.1",
    maxCharacterImages: 4,
    maxInputImages: 14,
  },
  pro: {
    key: "pro",
    id: process.env.FW_MODEL_PRO || "gemini-3-pro-image",
    label: "Nano Banana Pro",
    maxCharacterImages: 5,
    maxInputImages: 14,
  },
};

export function isArtModelKey(v: unknown): v is ArtModelKey {
  return v === "nb21" || v === "pro";
}

export const DEFAULT_ART_MODEL: ArtModelKey = isArtModelKey(process.env.FW_ART_MODEL)
  ? process.env.FW_ART_MODEL
  : "nb21";

export function artModel(key?: unknown): ArtModel {
  return ART_MODELS[isArtModelKey(key) ? key : DEFAULT_ART_MODEL];
}

/** Used when the chosen model id is rejected (renamed / not enabled). */
export const FALLBACK_IMAGE_MODEL = ART_MODELS.pro.id;

/** Lettering: Pro has the strongest text rendering for paragraphs. */
export const LETTERING_MODEL = process.env.FW_LETTER_MODEL || ART_MODELS.pro.id;

/**
 * Reference cards. Nano Banana 2.1 at 1K costs about a quarter of Pro
 * ($0.034 against $0.134 an image). Set an env var to "gemini-3-pro-image"
 * to put any one of them back on Pro without a code change.
 */
export const CHARACTER_CARD_MODEL = process.env.FW_CHARACTER_CARD_MODEL || ART_MODELS.nb21.id;
export const FULL_BODY_MODEL = process.env.FW_FULL_BODY_MODEL || ART_MODELS.nb21.id;
export const LOCATION_CARD_MODEL = process.env.FW_LOCATION_CARD_MODEL || ART_MODELS.nb21.id;

/**
 * Thinking level per card. Nano Banana 2.1 defaults to "medium", billed at
 * $7.50 per 1M thinking tokens. Character cards keep that default (likeness
 * from a photo is the hard part); places and full-body copies use "minimal".
 * Set the env var to "medium", "high" or "default" to change it.
 */
export type CardThinking = "minimal" | "medium" | "high" | "default";
const thinking = (v: string | undefined, fallback: CardThinking): CardThinking =>
  v === "minimal" || v === "medium" || v === "high" || v === "default" ? v : fallback;
export const CHARACTER_CARD_THINKING = thinking(process.env.FW_CHARACTER_CARD_THINKING, "default");
export const FULL_BODY_THINKING = thinking(process.env.FW_FULL_BODY_THINKING, "minimal");
export const LOCATION_CARD_THINKING = thinking(process.env.FW_LOCATION_CARD_THINKING, "minimal");

/** Vision (checking, boxes, reading text). Tried in order. */
export const VISION_MODELS: string[] = [
  process.env.FW_VISION_MODEL || "gemini-3.8-flash",
  "gemini-2.5-flash",
];

/** Spread output size. 2K keeps edit inputs small enough to send inline. */
export const SPREAD_IMAGE_SIZE = process.env.FW_SPREAD_SIZE || "2K";

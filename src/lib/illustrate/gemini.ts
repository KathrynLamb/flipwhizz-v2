// src/lib/illustrate/gemini.ts
//
// The only place that talks to Gemini for the illustration pipeline.
// - generateImage: retries transient errors, falls back to the stable Pro id
//   if a model id is rejected, and can retry without real photos if the
//   model refuses a request that contains them.
// - generateJson: vision/structured calls with model fallback.

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { FALLBACK_IMAGE_MODEL, VISION_MODELS } from "./models";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isModelRejected(err: unknown): boolean {
  const s = errText(err).toLowerCase();
  const status = (err as any)?.status ?? (err as any)?.code;
  return status === 404 || /models\/[^ ]+ is not found|not[_ ]found for api version|unknown model|model .*does not exist/.test(s);
}

export function isRateLimited(err: unknown): boolean {
  const s = errText(err).toLowerCase();
  const status = (err as any)?.status ?? (err as any)?.code;
  return Number(status) === 429 || /resource_exhausted|rate limit|quota/.test(s);
}

function isTransient(err: unknown): boolean {
  const s = errText(err).toLowerCase();
  const status = (err as any)?.status ?? (err as any)?.code;
  return (
    [429, 500, 502, 503, 504].includes(Number(status)) ||
    /overloaded|unavailable|deadline|timeout|resource_exhausted|internal|fetch failed|econnreset|socket|network|terminated/.test(s)
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Model ids Google refused in this process: skip straight to the fallback
// instead of paying a failed round-trip on every call.
const rejectedModels = new Set<string>();

/** Last non-thought image in the response (thinking can emit interim images). */
export function extractImage(response: any): { data: Buffer; mimeType: string } | null {
  const parts: any[] = response?.candidates?.[0]?.content?.parts ?? [];
  const finals = parts.filter((p) => p?.inlineData?.data && !p.thought);
  const pick = finals.at(-1) ?? parts.filter((p) => p?.inlineData?.data).at(-1);
  if (!pick) return null;
  return { data: Buffer.from(pick.inlineData.data, "base64"), mimeType: pick.inlineData.mimeType ?? "image/png" };
}

function responseText(response: any): string {
  const parts: any[] = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => typeof p?.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function whyNoImage(response: any): string {
  const c = response?.candidates?.[0];
  return `finish=${c?.finishReason ?? "?"} block=${response?.promptFeedback?.blockReason ?? "none"} text=${responseText(response).slice(0, 160)}`;
}

export type GenerateImageArgs = {
  model: string;
  parts: any[];
  aspectRatio: string;
  imageSize?: string;
  label: string;
  /** Parts that are real photos; dropped on a retry if the model refuses. */
  photoParts?: any[];
};

export async function generateImage(args: GenerateImageArgs): Promise<{ data: Buffer; mimeType: string; model: string; droppedPhotos: boolean }> {
  const { aspectRatio, imageSize = "2K", label } = args;

  const call = async (model: string, parts: any[]) =>
    client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio, imageSize },
        safetySettings: SAFETY,
      } as any,
    });

  let model = rejectedModels.has(args.model) ? FALLBACK_IMAGE_MODEL : args.model;
  let parts = args.parts;
  let droppedPhotos = false;
  let lastProblem = "";

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await call(model, parts);
      const img = extractImage(res);
      if (img) return { ...img, model, droppedPhotos };
      lastProblem = whyNoImage(res);
      console.warn(`🖼️ [${label}] no image (attempt ${attempt}, ${model}): ${lastProblem}`);
      // Refusal: try once without real photos, then once more as-is.
      if (!droppedPhotos && args.photoParts?.length) {
        const drop = new Set(args.photoParts);
        parts = parts.filter((p) => !drop.has(p));
        droppedPhotos = true;
        continue;
      }
    } catch (err) {
      lastProblem = errText(err);
      if (isModelRejected(err) && model !== FALLBACK_IMAGE_MODEL) {
        console.warn(`🖼️ [${label}] model ${model} rejected (${lastProblem.slice(0, 300)}); falling back to ${FALLBACK_IMAGE_MODEL}`);
        rejectedModels.add(model);
        model = FALLBACK_IMAGE_MODEL;
        continue;
      }
      if (!isTransient(err) && !(args.photoParts?.length && !droppedPhotos)) throw err;
      if (!isTransient(err)) {
        const drop = new Set(args.photoParts);
        parts = parts.filter((p) => !drop.has(p));
        droppedPhotos = true;
        console.warn(`🖼️ [${label}] request rejected with photos (${lastProblem.slice(0, 160)}); retrying without photos`);
        continue;
      }
      console.warn(`🖼️ [${label}] transient error (attempt ${attempt}): ${lastProblem.slice(0, 160)}`);
      // Rate limits need a real pause; let Inngest's own retry back off after this.
      if (isRateLimited(err)) {
        if (attempt >= 2) throw err;
        await sleep(15000);
        continue;
      }
    }
    await sleep(1500 * attempt);
  }
  throw new Error(`[${label}] Gemini returned no image after retries: ${lastProblem.slice(0, 300)}`);
}

function parseJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

/** Structured vision call. Throws only if every vision model fails. */
export async function generateJson<T>(parts: any[], label: string): Promise<T> {
  let last = "";
  for (const model of VISION_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await client.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          // Google advises keeping Gemini 3's default temperature.
          config: { responseMimeType: "application/json" } as any,
        });
        const parsed = parseJson<T>(responseText(res));
        if (parsed) return parsed;
        last = `unparseable reply from ${model}: ${responseText(res).slice(0, 160)}`;
      } catch (err) {
        last = `${model}: ${errText(err).slice(0, 200)}`;
        if (isModelRejected(err)) break; // next model
      }
      console.warn(`🔎 [${label}] ${last} (attempt ${attempt})`);
      await sleep(1000 * attempt);
    }
  }
  throw new Error(`[${label}] vision call failed: ${last}`);
}

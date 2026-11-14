// src/lib/ai/cardImage.ts
//
// One image call for a reference card (character card, full-body reference,
// location card), with the card's thinking level applied.
//
// Thinking levels only exist on Nano Banana 2.1, so the setting is left off
// for any other model. If Google rejects the setting (400 / invalid
// argument), the call is repeated once without it and the setting stays off
// for the life of this server process, so a card is never lost to a config
// option. Every other error is thrown unchanged.

import type { GoogleGenAI } from "@google/genai";
import type { CardThinking } from "@/lib/illustrate/models";

let thinkingRejected = false;

const supportsThinkingLevel = (model: string) => model.startsWith("gemini-nano-banana");

function isInvalidArgument(err: any): boolean {
  const status = err?.status ?? err?.code;
  const text = String(err?.message ?? err ?? "");
  return status === 400 || status === "INVALID_ARGUMENT" || /INVALID_ARGUMENT|\b400\b/.test(text);
}

export async function generateCardImage(
  client: GoogleGenAI,
  params: { model: string; contents: any; config: Record<string, any> },
  thinking: CardThinking,
) {
  const useThinking = thinking !== "default" && !thinkingRejected && supportsThinkingLevel(params.model);
  if (!useThinking) return client.models.generateContent(params as any);

  try {
    return await client.models.generateContent({
      ...params,
      config: { ...params.config, thinkingConfig: { thinkingLevel: thinking } },
    } as any);
  } catch (err) {
    if (!isInvalidArgument(err)) throw err;
    thinkingRejected = true;
    console.warn(
      `[card-image] ${params.model} rejected thinkingLevel "${thinking}"; retrying without it:`,
      String((err as any)?.message ?? err).slice(0, 200),
    );
    return client.models.generateContent(params as any);
  }
}

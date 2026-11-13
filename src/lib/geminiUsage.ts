// src/lib/geminiUsage.ts
//
// Every Gemini client in the app is made here, so every call is counted.
// Each generateContent call logs one "[gemini-usage]" JSON line (Vercel logs)
// and one "gemini_call" PostHog event: where it came from, which model, image
// size, tokens in/out, success, and how long it took. Chart "gemini_call" in
// PostHog by source and model to see where the credits go.
//
// Operational data only: no user ids, prompts or emails. Never throws its own
// errors; a Gemini billing block is rethrown as NonRetriableError.

import { GoogleGenAI, type GoogleGenAIOptions } from "@google/genai";
import { PostHog } from "posthog-node";
import { AsyncLocalStorage } from "node:async_hooks";
import { NonRetriableError } from "inngest";
import { isBillingBlocked } from "@/lib/userErrors";

/** Optional finer label for calls inside a shared helper (e.g. "compose", "letter", "fix"). */
const labelStore = new AsyncLocalStorage<string>();
export function withGeminiLabel<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return labelStore.run(label, fn);
}

let posthog: PostHog | null = null;
function ph(): PostHog | null {
  if (posthog) return posthog;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  posthog = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return posthog;
}

function record(props: Record<string, unknown>) {
  try {
    console.log(`[gemini-usage] ${JSON.stringify(props)}`);
  } catch {}
  try {
    const client = ph();
    if (!client) return;
    client.capture({ distinctId: "system", event: "gemini_call", properties: props });
    // Serverless: flush now so the event isn't lost when the function freezes.
    void client.flush().catch(() => {});
  } catch {}
}

export function trackedGemini(source: string, opts: GoogleGenAIOptions): GoogleGenAI {
  const client = new GoogleGenAI(opts);
  const models: any = client.models;
  const original = models.generateContent.bind(models);

  models.generateContent = async (params: any) => {
    const started = Date.now();
    const cfg = params?.config ?? {};
    const base = {
      source,
      label: labelStore.getStore() ?? null,
      model: String(params?.model ?? "?"),
      image: Array.isArray(cfg.responseModalities) && cfg.responseModalities.includes("IMAGE"),
      image_size: cfg.imageConfig?.imageSize ?? null,
    };
    try {
      const res = await original(params);
      const u = res?.usageMetadata ?? {};
      const parts: any[] = res?.candidates?.[0]?.content?.parts ?? [];
      record({
        ...base,
        ok: true,
        images_out: parts.filter((p) => p?.inlineData?.data && !p.thought).length,
        prompt_tokens: u.promptTokenCount ?? null,
        output_tokens: u.candidatesTokenCount ?? null,
        thought_tokens: u.thoughtsTokenCount ?? null,
        total_tokens: u.totalTokenCount ?? null,
        finish: res?.candidates?.[0]?.finishReason ?? null,
        ms: Date.now() - started,
      });
      return res;
    } catch (err: any) {
      record({
        ...base,
        ok: false,
        status: err?.status ?? err?.code ?? null,
        error: String(err?.message ?? err).slice(0, 200),
        ms: Date.now() - started,
      });
      // Spending cap / billing block: no retry can help, so make sure no
      // Inngest step burns its retries on it. Every caller is covered here,
      // including ones that don't go through lib/illustrate/gemini.ts.
      if (isBillingBlocked(err) && !(err instanceof NonRetriableError)) {
        throw new NonRetriableError(
          `[${source}] Gemini billing blocked (raise the spend cap or top up at https://ai.studio/spend): ${String(err?.message ?? err).slice(0, 300)}`,
          { cause: err },
        );
      }
      throw err;
    }
  };

  return client;
}

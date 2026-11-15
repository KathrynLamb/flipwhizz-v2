// src/lib/ai/anthropicUsage.ts
//
// Every Claude client in the app is made here, so every call is counted the
// same way as Gemini calls (src/lib/geminiUsage.ts): one log line, one
// PostHog "gemini_call" event (the name is historical; provider says which),
// and, inside a usage context, one priced ai_usage row for the book.
//
// Only messages.create is wrapped, and it returns a plain promise (nothing
// in the app uses the SDK's .withResponse()). A streamed create
// (stream: true) is passed through uncounted; nothing in the app streams today.

import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import { recordAiCall } from "@/lib/geminiUsage";
import { costMicroUsd } from "@/lib/ai/pricing";

export function trackedAnthropic(source: string, opts: ClientOptions = {}): Anthropic {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...opts });
  const messages: any = client.messages;
  const original = messages.create.bind(messages);

  messages.create = async (params: any, options?: any) => {
    if (params?.stream) return original(params, options);
    const started = Date.now();
    const base = { provider: "anthropic", source, label: null, model: String(params?.model ?? "?"), image: false, image_size: null };
    try {
      const res = await original(params, options);
      const u = res?.usage ?? {};
      const cacheWrite = u.cache_creation_input_tokens ?? 0;
      const cacheRead = u.cache_read_input_tokens ?? 0;
      // Awaited like the Gemini wrapper: on serverless an unawaited save can be lost.
      await recordAiCall({
        ...base,
        ok: true,
        images_out: 0,
        prompt_tokens: u.input_tokens ?? null,
        output_tokens: u.output_tokens ?? null,
        thought_tokens: null,
        total_tokens: (u.input_tokens ?? 0) + cacheWrite + cacheRead + (u.output_tokens ?? 0),
        cache_write_tokens: cacheWrite || null,
        cache_read_tokens: cacheRead || null,
        cost_micro_usd: costMicroUsd({
          model: base.model,
          image: false,
          promptTokens: u.input_tokens,
          outputTokens: u.output_tokens,
          cacheWriteTokens: cacheWrite,
          cacheReadTokens: cacheRead,
        }),
        finish: res?.stop_reason ?? null,
        ms: Date.now() - started,
      });
      return res;
    } catch (err: any) {
      await recordAiCall({
        ...base,
        ok: false,
        status: err?.status ?? null,
        error: String(err?.message ?? err).slice(0, 200),
        ms: Date.now() - started,
      });
      throw err;
    }
  };

  return client;
}

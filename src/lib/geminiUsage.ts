// src/lib/geminiUsage.ts
//
// Every Gemini client in the app is made here, so every call is counted.
// Each generateContent call logs one "[gemini-usage]" JSON line (Vercel logs)
// and one "gemini_call" PostHog event: where it came from, which model, image
// size, tokens in/out, success, and how long it took. Chart "gemini_call" in
// PostHog by source and model to see where the credits go.
//
// Calls made inside withUsageContext() (character and location cards) are
// also priced and saved to the ai_usage table, tagged with their story and
// the character or location they were for. That table is what the "cards
// approved" report emails read (src/lib/emails/sendCardsReport.ts).
//
// Operational data only: no user ids, prompts or emails. Never throws.

import { GoogleGenAI, type GoogleGenAIOptions } from "@google/genai";
import { PostHog } from "posthog-node";
import { AsyncLocalStorage } from "node:async_hooks";
import { costMicroUsd } from "@/lib/ai/pricing";

/** Optional finer label for calls inside a shared helper (e.g. "compose", "letter", "fix"). */
const labelStore = new AsyncLocalStorage<string>();
export function withGeminiLabel<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return labelStore.run(label, fn);
}

/* ------------------------------------------------------------------ */
/* Usage context: which book and which card a call belongs to          */
/* ------------------------------------------------------------------ */

export type UsageKind = "character_card" | "character_full_body" | "location_card";

export type UsageContext = {
  kind: UsageKind;
  storyId?: string | null;
  /** The character or location id. */
  entityId?: string | null;
};

const usageStore = new AsyncLocalStorage<UsageContext>();

/**
 * Every Gemini call made inside fn is saved to ai_usage with this context.
 * An outer context wins, so a helper can set one without overriding its caller.
 */
export function withUsageContext<T>(ctx: UsageContext, fn: () => Promise<T>): Promise<T> {
  const outer = usageStore.getStore();
  if (outer) {
    if (!outer.storyId && ctx.storyId) outer.storyId = ctx.storyId;
    if (!outer.entityId && ctx.entityId) outer.entityId = ctx.entityId;
    return fn();
  }
  return usageStore.run({ ...ctx }, fn);
}

/** Fill in the story or entity once it is known (e.g. after reading the request body). */
export function annotateUsage(patch: Partial<Pick<UsageContext, "storyId" | "entityId">>): void {
  const ctx = usageStore.getStore();
  if (!ctx) return;
  if (patch.storyId) ctx.storyId = patch.storyId;
  if (patch.entityId) ctx.entityId = patch.entityId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID_RE.test(v) ? v : null);
const intOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** Save one call to ai_usage. Awaited (serverless), capped at 2s, never throws. */
async function saveUsage(ctx: UsageContext, props: Record<string, any>): Promise<void> {
  try {
    const write = (async () => {
      const [{ db }, { aiUsage }] = await Promise.all([import("@/db"), import("@/db/schema")]);
      await db.insert(aiUsage).values({
        storyId: uuidOrNull(ctx.storyId),
        kind: ctx.kind,
        entityId: uuidOrNull(ctx.entityId),
        source: String(props.source ?? "?"),
        label: props.label ?? null,
        model: String(props.model ?? "?"),
        image: !!props.image,
        imageSize: props.image_size ?? null,
        ok: !!props.ok,
        imagesOut: intOrNull(props.images_out) ?? 0,
        promptTokens: intOrNull(props.prompt_tokens),
        outputTokens: intOrNull(props.output_tokens),
        thoughtTokens: intOrNull(props.thought_tokens),
        totalTokens: intOrNull(props.total_tokens),
        costMicroUsd: intOrNull(props.cost_micro_usd),
        ms: intOrNull(props.ms),
        error: props.error ? String(props.error).slice(0, 300) : null,
      });
    })();
    await Promise.race([write, new Promise((r) => setTimeout(r, 2000))]);
  } catch (err) {
    console.warn("[gemini-usage] could not save ai_usage row:", String((err as any)?.message ?? err).slice(0, 200));
  }
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

async function record(props: Record<string, unknown>) {
  const ctx = usageStore.getStore();
  if (ctx) props = { ...props, kind: ctx.kind, story_id: ctx.storyId ?? null, entity_id: ctx.entityId ?? null };
  try {
    console.log(`[gemini-usage] ${JSON.stringify(props)}`);
  } catch {}
  try {
    const client = ph();
    if (client) client.capture({ distinctId: "system", event: "gemini_call", properties: props });
    // Serverless: flush now so the event isn't lost when the function freezes.
    if (client) void client.flush().catch(() => {});
  } catch {}
  if (ctx) await saveUsage(ctx, props);
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
      const imagesOut = parts.filter((p) => p?.inlineData?.data && !p.thought).length;
      await record({
        ...base,
        ok: true,
        images_out: imagesOut,
        prompt_tokens: u.promptTokenCount ?? null,
        output_tokens: u.candidatesTokenCount ?? null,
        thought_tokens: u.thoughtsTokenCount ?? null,
        total_tokens: u.totalTokenCount ?? null,
        // Estimated list-price cost of this call, in micro-dollars.
        cost_micro_usd: costMicroUsd({
          model: base.model,
          image: base.image,
          imageSize: base.image_size,
          imagesOut,
          promptTokens: u.promptTokenCount,
          outputTokens: u.candidatesTokenCount,
          thoughtTokens: u.thoughtsTokenCount,
        }),
        finish: res?.candidates?.[0]?.finishReason ?? null,
        ms: Date.now() - started,
      });
      return res;
    } catch (err: any) {
      await record({
        ...base,
        ok: false,
        status: err?.status ?? err?.code ?? null,
        error: String(err?.message ?? err).slice(0, 200),
        ms: Date.now() - started,
      });
      throw err;
    }
  };

  return client;
}

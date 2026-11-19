// src/lib/geminiUsage.ts
//
// Every Gemini client in the app is made here, so every call is counted.
// Each generateContent call logs one "[gemini-usage]" JSON line (Vercel logs)
// and one "gemini_call" PostHog event: where it came from, which model, image
// size, tokens in/out, success, and how long it took. Chart "gemini_call" in
// PostHog by source and model to see where the credits go.
//
// Calls made inside withUsageContext() are also priced and saved to the
// ai_usage table, tagged with their book (or, before the book exists, its
// project) and what they were for. Contexts are set by the Inngest usage
// middleware (every background job), by withAccess (every API route that
// names a story or project) and more specifically by the card routes and
// the spread worker. Claude calls are saved the same way
// (src/lib/ai/anthropicUsage.ts). The admin Costs tab and the report
// emails read that table.
//
// Operational data only: no user ids, prompts or emails. Never throws its own
// errors; a Gemini billing block is rethrown as NonRetriableError.

import { GoogleGenAI, type GoogleGenAIOptions } from "@google/genai";
import { PostHog } from "posthog-node";
import { AsyncLocalStorage } from "node:async_hooks";
import { costMicroUsd } from "@/lib/ai/pricing";
import { NonRetriableError } from "inngest";
import { isBillingBlocked } from "@/lib/userErrors";

/** Optional finer label for calls inside a shared helper (e.g. "compose", "letter", "fix"). */
const labelStore = new AsyncLocalStorage<string>();
export function withGeminiLabel<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return labelStore.run(label, fn);
}

/* ------------------------------------------------------------------ */
/* Usage context: which book and which card a call belongs to          */
/* ------------------------------------------------------------------ */

/**
 * What a call was for. The admin Costs tab and the report emails group by it.
 * - character_card, character_full_body, location_card: the card pictures
 * - characters: other character work (photo analysis, outfits, refreshes)
 * - spread: everything done while drawing a spread; its label names the step
 * - world: world building and reference sheets
 * - style: the style plate
 * - planning: scene plans and spread prompts
 * - cover: cover planning and drawing
 * - writing: the story itself (chat, rewrites, author letter)
 * - other: anything not mapped yet
 */
export type UsageKind =
  | "character_card"
  | "character_full_body"
  | "location_card"
  | "characters"
  | "spread"
  | "world"
  | "style"
  | "planning"
  | "cover"
  | "writing"
  | "other";

export type UsageContext = {
  kind: UsageKind;
  storyId?: string | null;
  /** For calls made before the book exists (writing the story in chat). */
  projectId?: string | null;
  /** The character or location id. */
  entityId?: string | null;
  /**
   * A broad default set by a wrapper (an Inngest function, an API route).
   * A more specific context set inside it replaces its kind.
   */
  fallback?: boolean;
};

const usageStore = new AsyncLocalStorage<UsageContext>();

/**
 * Every AI call made inside fn is saved to ai_usage with this context.
 * An outer specific context wins, so a helper can set one without overriding
 * its caller; an outer fallback context gives way to the inner one but still
 * lends it the story and project ids.
 */
export function withUsageContext<T>(ctx: UsageContext, fn: () => Promise<T>): Promise<T> {
  const outer = usageStore.getStore();
  if (outer && !outer.fallback) {
    if (!outer.storyId && ctx.storyId) outer.storyId = ctx.storyId;
    if (!outer.projectId && ctx.projectId) outer.projectId = ctx.projectId;
    if (!outer.entityId && ctx.entityId) outer.entityId = ctx.entityId;
    return fn();
  }
  if (outer && ctx.fallback) {
    // Two broad defaults: keep the outer kind, fill in what it lacks.
    if (!outer.storyId && ctx.storyId) outer.storyId = ctx.storyId;
    if (!outer.projectId && ctx.projectId) outer.projectId = ctx.projectId;
    return fn();
  }
  return usageStore.run(
    {
      ...ctx,
      storyId: ctx.storyId ?? outer?.storyId ?? null,
      projectId: ctx.projectId ?? outer?.projectId ?? null,
    },
    fn
  );
}

/** Fill in the story or entity once it is known (e.g. after reading the request body). */
export function annotateUsage(patch: Partial<Pick<UsageContext, "storyId" | "projectId" | "entityId">>): void {
  const ctx = usageStore.getStore();
  if (!ctx) return;
  if (patch.storyId) ctx.storyId = patch.storyId;
  if (patch.projectId) ctx.projectId = patch.projectId;
  if (patch.entityId) ctx.entityId = patch.entityId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID_RE.test(v) ? v : null);
const intOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** Before scripts/sql/2026-11-15-ai-usage-project.sql is run, ai_usage has no project_id. */
let projectColumnMissing = false;

/** Save one call to ai_usage. Awaited (serverless), capped at 2s, never throws. */
async function saveUsage(ctx: UsageContext, props: Record<string, any>): Promise<void> {
  // Nothing to attribute it to: the call is still logged and sent to PostHog.
  if (!uuidOrNull(ctx.storyId) && !uuidOrNull(ctx.projectId)) return;
  try {
    const write = (async () => {
      const [{ db }, { aiUsage }] = await Promise.all([import("@/db"), import("@/db/schema")]);
      const row = {
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
      };
      if (!projectColumnMissing) {
        try {
          await db.insert(aiUsage).values({ ...row, projectId: uuidOrNull(ctx.projectId) });
          return;
        } catch (err) {
          if (!/project_id/.test(String((err as any)?.cause?.message ?? (err as any)?.message ?? err))) throw err;
          projectColumnMissing = true;
          console.warn("[gemini-usage] ai_usage.project_id is missing: run scripts/sql/2026-11-15-ai-usage-project.sql");
        }
      }
      if (!row.storyId) return; // a project-only row needs the new column
      // Drizzle would name every column, project_id included, so list them by hand.
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`
        INSERT INTO ai_usage (story_id, kind, entity_id, source, label, model, image, image_size, ok, images_out,
                              prompt_tokens, output_tokens, thought_tokens, total_tokens, cost_micro_usd, ms, error)
        VALUES (${row.storyId}, ${row.kind}, ${row.entityId}, ${row.source}, ${row.label}, ${row.model}, ${row.image},
                ${row.imageSize}, ${row.ok}, ${row.imagesOut}, ${row.promptTokens}, ${row.outputTokens}, ${row.thoughtTokens},
                ${row.totalTokens}, ${row.costMicroUsd}, ${row.ms}, ${row.error})`);
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

/** Log, send to PostHog and (inside a usage context) save one AI call. Used by the Anthropic wrapper too. */
export async function recordAiCall(props: Record<string, unknown>) {
  const ctx = usageStore.getStore();
  if (ctx) props = { ...props, kind: ctx.kind, story_id: ctx.storyId ?? null, project_id: ctx.projectId ?? null, entity_id: ctx.entityId ?? null };
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
      await recordAiCall({
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
      await recordAiCall({
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

// src/inngest/usageMiddleware.ts
//
// Tags every AI call made by a background job with its book, so the admin
// Costs tab sees the whole cost of a book: world building, reference sheets,
// style plate, scene planning, cover, outfits, spreads. The job's storyId
// comes from its event; what the call was for comes from the job's id.
//
// The context is a fallback: code inside a job that sets its own (the spread
// worker's per-step tracking, the card helpers) replaces the kind but keeps
// the book. Both the function handler and each step handler are wrapped,
// because step code can run outside the handler's async context.

import { Middleware } from "inngest";
import { withUsageContext, type UsageKind } from "@/lib/geminiUsage";

const KIND_BY_FUNCTION: Record<string, UsageKind> = {
  "ensure-world": "world",
  "generate-style-sample": "style",
  "decide-scenes-v5": "planning",
  "build-spread-prompts": "planning",
  "build-spreads": "planning",
  "generate-book-spreads": "planning",
  "generate-single-spread": "spread",
  "revise-single-spread": "spread",
  "plan-cover-spread": "cover",
  "generate-cover-spread-v5": "cover",
  "generate-cover-spread-phase-b": "cover",
  "analyse-reference-photo": "characters",
  "generate-character-outfits": "characters",
  "refresh-character": "characters",
  "global-rewrite-job": "writing",
};

function contextFor(fn: unknown, ctx: unknown) {
  const id: string = (fn as any)?.opts?.id ?? "";
  const data = (ctx as any)?.event?.data ?? {};
  const storyId = typeof data.storyId === "string" ? data.storyId : null;
  const projectId = typeof data.projectId === "string" ? data.projectId : null;
  if (!storyId && !projectId) return null;
  return { kind: KIND_BY_FUNCTION[id] ?? ("other" as UsageKind), storyId, projectId, fallback: true };
}

export class UsageMiddleware extends Middleware.BaseMiddleware {
  readonly id = "flipwhizz-ai-usage";

  async wrapFunctionHandler({ fn, ctx, next }: Middleware.WrapFunctionHandlerArgs): Promise<unknown> {
    const usage = contextFor(fn, ctx);
    return usage ? withUsageContext(usage, () => next()) : next();
  }

  async wrapStepHandler({ fn, ctx, next }: Middleware.WrapStepHandlerArgs): Promise<unknown> {
    const usage = contextFor(fn, ctx);
    return usage ? withUsageContext(usage, () => next()) : next();
  }
}

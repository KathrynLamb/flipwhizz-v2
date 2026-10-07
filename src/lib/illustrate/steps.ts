// src/lib/illustrate/steps.ts
//
// The check-and-fix loop and the lettering loop, written as Inngest steps so
// every model call is retried and memoised on its own, and every
// intermediate image is a small URL in step output (never base64).
//
//   checkAndFix:  inspect -> (add missing | fix people in waves) -> inspect ...
//                 up to maxRounds fix rounds, then "flagged" with the list
//   letterAndCheck: letter (Pro) -> read back -> composite the text areas
//                 onto the checked art; one retry with the problems named

import { fetchImage, upload, pastePatch } from "./images";
import { inspectArt, fixCrop, addMissing, letterArt, readText, judge, compositeText } from "./checkfix";
import { planFixes, wavesOf, type CastRef, type CropFix, type InspectReport } from "./plan";
import { isRateLimited } from "./gemini";
import type { CropPlan, TextVerdict } from "./geometry";

type Step = { run: <T>(id: string, fn: () => Promise<T>) => Promise<any> };

export type QaStatus = "ok" | "fixed" | "flagged" | "unchecked";

export type QaResult = {
  artUrl: string;
  alsoUrls: string[];
  status: QaStatus;
  rounds: number;
  fixesApplied: number;
  remaining: string[];
  log: string[];
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function checkAndFix(
  step: Step,
  o: {
    prefix: string;
    artUrl: string;
    cast: CastRef[];
    expectedIds: string[];
    forbiddenIds?: string[];
    focusIds?: string[];
    sceneHint: string;
    sizeNotes?: string;
    styleBlock: string;
    modelId: string;
    aspectRatio: string;
    imageSize: string;
    folder: string;
    maxRounds?: number;
    /** Other images of identical size that should receive the same patches. */
    alsoPatch?: string[];
    /** Art already carries text (covers, lettered pages): fixes must keep it. */
    preserveText?: boolean;
    /** Covers may show a character twice on purpose. */
    allowDuplicates?: boolean;
    /** Whole-picture "add the missing character" edits (off for covers: they redraw the title). */
    allowAdd?: boolean;
  }
): Promise<QaResult> {
  const maxRounds = o.maxRounds ?? 2;
  let artUrl = o.artUrl;
  let alsoUrls = o.alsoPatch ?? [];
  const log: string[] = [];
  let fixesApplied = 0;

  if (o.cast.length === 0) {
    return { artUrl, alsoUrls, status: "ok", rounds: 0, fixesApplied, remaining: [], log: ["no cast to check"] };
  }

  for (let r = 0; r <= maxRounds; r++) {
    const inspected: { report?: InspectReport; error?: string } = await step.run(`${o.prefix}-inspect-${r}`, async () => {
      try {
        const art = await fetchImage(artUrl);
        return { report: await inspectArt({ art, cast: o.cast, expectedIds: o.expectedIds, sceneHint: o.sceneHint }) };
      } catch (e) {
        return { error: msg(e) };
      }
    });

    if (!inspected.report) {
      log.push(`check failed: ${inspected.error}`);
      return { artUrl, alsoUrls, status: "unchecked", rounds: r, fixesApplied, remaining: [], log };
    }
    // Nobody found at all in a picture that should have several people is
    // almost always a bad reply, not an empty picture: don't "add" everyone.
    if (inspected.report.people.length === 0 && o.expectedIds.length > 1) {
      log.push("checker found nobody; treating the check as failed");
      return { artUrl, alsoUrls, status: "unchecked", rounds: r, fixesApplied, remaining: [], log };
    }

    const plan = planFixes(inspected.report, o.cast, {
      focusIds: o.focusIds,
      forbiddenIds: o.forbiddenIds,
      allowDuplicates: o.allowDuplicates,
    });
    if (plan.clean) {
      return { artUrl, alsoUrls, status: fixesApplied > 0 ? "fixed" : "ok", rounds: r, fixesApplied, remaining: [], log };
    }
    if (r === maxRounds) {
      return { artUrl, alsoUrls, status: "flagged", rounds: r, fixesApplied, remaining: plan.summary, log };
    }
    log.push(...plan.summary.map((s) => `round ${r + 1}: ${s}`));

    // Missing characters with nowhere to put them: one whole-picture edit,
    // then re-check (the edit can shift other people slightly).
    const canAdd = o.allowAdd !== false && !o.focusIds?.length && alsoUrls.length === 0;
    if (plan.crops.length === 0 && (!canAdd || plan.add.length === 0)) {
      // Nothing we are allowed to do about what's wrong.
      return { artUrl, alsoUrls, status: "flagged", rounds: r, fixesApplied, remaining: plan.summary, log };
    }

    if (plan.add.length > 0 && canAdd && plan.crops.every((c) => c.kind === "likeness")) {
      const added: { url?: string; error?: string } = await step.run(`${o.prefix}-add-${r}`, async () => {
        try {
          const art = await fetchImage(artUrl);
          const missing = o.cast.filter((c) => plan.add.includes(c.id));
          const out = await addMissing({
            art,
            missing,
            model: o.modelId,
            aspectRatio: o.aspectRatio,
            imageSize: o.imageSize,
            sceneHint: o.sceneHint,
            sizeNotes: o.sizeNotes,
            styleBlock: o.styleBlock,
          });
          return { url: await upload(out.art, o.folder) };
        } catch (e) {
          return { error: msg(e) };
        }
      });
      if (added.url) {
        artUrl = added.url;
        fixesApplied++;
        continue;
      }
      log.push(`add failed: ${added.error}`);
    }

    // Non-overlapping fixes run side by side, at most 3 at a time so several
    // books at once don't blow the image-model rate limit.
    const waves = wavesOf(plan.crops).flatMap((wave) => {
      const chunks: CropFix[][] = [];
      for (let i = 0; i < wave.length; i += 3) chunks.push(wave.slice(i, i + 3));
      return chunks;
    });
    for (let w = 0; w < waves.length; w++) {
      const results: ({ patchUrl: string; plan: CropPlan; fix: CropFix; grow: number } | null)[] = await Promise.all(
        waves[w].map((fix, i) =>
          step.run(`${o.prefix}-fix-${r}-${w}-${i}`, async () => {
            try {
              const art = await fetchImage(artUrl);
              const out = await fixCrop({ art, fix, cast: o.cast, model: o.modelId, styleBlock: o.styleBlock, preserveText: o.preserveText });
              return { patchUrl: await upload(out.patch, `${o.folder}/patches`), plan: out.plan, fix, grow: out.grow };
            } catch (e) {
              // Rate limited: let Inngest retry this step with its own backoff.
              if (isRateLimited(e)) throw e;
              console.warn(`⚠️ ${o.prefix} fix ${fix.kind} failed: ${msg(e)}`);
              return null;
            }
          })
        )
      );
      const ok = results.filter(Boolean) as { patchUrl: string; plan: CropPlan; fix: CropFix; grow: number }[];
      if (ok.length === 0) continue;

      const pasted: { artUrl: string; alsoUrls: string[] } = await step.run(`${o.prefix}-paste-${r}-${w}`, async () => {
        const patches = await Promise.all(ok.map(async (p) => ({ buf: await fetchImage(p.patchUrl), plan: p.plan, grow: p.grow })));
        const apply = async (url: string) => {
          let img = await fetchImage(url);
          for (const p of patches) img = await pastePatch(img, p.buf, p.plan.crop, p.plan.subject, { grow: p.grow });
          return upload(img, o.folder);
        };
        return { artUrl: await apply(artUrl), alsoUrls: await Promise.all(alsoUrls.map(apply)) };
      });
      artUrl = pasted.artUrl;
      alsoUrls = pasted.alsoUrls;
      fixesApplied += ok.length;
    }
  }

  // Unreachable (the loop returns), kept for the type checker.
  return { artUrl, alsoUrls, status: "flagged", rounds: maxRounds, fixesApplied, remaining: [], log };
}

export type LetterResult = {
  finalUrl: string;
  text: (TextVerdict & { attempts: number; method: string }) | null;
  /** Where the lettering is, so later per-character fixes can put it back. */
  blocks: any[];
};

export async function letterAndCheck(
  step: Step,
  o: {
    prefix: string;
    artUrl: string;
    leftText: string;
    rightText: string;
    typography: string;
    aspectRatio: string;
    imageSize: string;
    folder: string;
  }
): Promise<LetterResult> {
  if (!o.leftText?.trim() && !o.rightText?.trim()) return { finalUrl: o.artUrl, text: null, blocks: [] };

  let best: { url: string; verdict: TextVerdict | null; score: number; blocks: any[] } | null = null;
  let feedback = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const lettered: { url?: string; error?: string } = await step.run(`${o.prefix}-letter-${attempt}`, async () => {
      try {
        const art = await fetchImage(o.artUrl);
        const out = await letterArt({ art, leftText: o.leftText, rightText: o.rightText, typography: o.typography, aspectRatio: o.aspectRatio, imageSize: o.imageSize, feedback });
        return { url: await upload(out, o.folder) };
      } catch (e) {
        return { error: msg(e) };
      }
    });
    if (!lettered.url) {
      console.warn(`⚠️ ${o.prefix} lettering attempt ${attempt} failed: ${lettered.error}`);
      continue;
    }

    const checked: { blocks?: any[]; verdict?: TextVerdict; error?: string } = await step.run(`${o.prefix}-read-${attempt}`, async () => {
      try {
        const blocks = await readText(await fetchImage(lettered.url!));
        return { blocks, verdict: judge(blocks, o.leftText, o.rightText) };
      } catch (e) {
        return { error: msg(e) };
      }
    });

    if (!checked.verdict) {
      // Can't read it back: keep the lettered picture rather than lose the page.
      if (!best) best = { url: lettered.url, verdict: null, score: -1, blocks: [] };
      continue;
    }

    const score = checked.verdict.left + checked.verdict.right;
    if (checked.verdict.ok) {
      const composed: { url?: string; error?: string } = await step.run(`${o.prefix}-composite-${attempt}`, async () => {
        try {
          const out = await compositeText(await fetchImage(o.artUrl), await fetchImage(lettered.url!), checked.blocks as any);
          return { url: await upload(out, o.folder) };
        } catch (e) {
          return { error: msg(e) };
        }
      });
      return {
        finalUrl: composed.url ?? lettered.url,
        text: { ...checked.verdict, attempts: attempt, method: composed.url ? "composited" : "whole" },
        blocks: checked.blocks ?? [],
      };
    }
    if (!best || score > best.score) best = { url: lettered.url, verdict: checked.verdict, score, blocks: checked.blocks ?? [] };
    feedback = checked.verdict.problems.join("; ");
  }

  if (!best) {
    // Lettering failed outright twice: ship the art without text rather than
    // nothing, and the QA record flags it.
    return { finalUrl: o.artUrl, text: { ok: false, left: 0, right: 0, problems: ["lettering failed"], attempts: 2, method: "none" }, blocks: [] };
  }
  // Still paste only the text areas when we know where they are, so the
  // faces stay exactly as checked even when the wording isn't perfect.
  const chosen = best;
  let finalUrl = chosen.url;
  let method = "whole";
  if (chosen.blocks.length > 0) {
    const composed: { url?: string } = await step.run(`${o.prefix}-composite-best`, async () => {
      try {
        const out = await compositeText(await fetchImage(o.artUrl), await fetchImage(chosen.url), chosen.blocks as any);
        return { url: await upload(out, o.folder) };
      } catch {
        return {};
      }
    });
    if (composed.url) {
      finalUrl = composed.url;
      method = "composited";
    }
  }
  return {
    finalUrl,
    text: chosen.verdict
      ? { ...chosen.verdict, attempts: 2, method }
      : { ok: false, left: 0, right: 0, problems: ["could not read the lettering back"], attempts: 2, method },
    blocks: chosen.blocks,
  };
}

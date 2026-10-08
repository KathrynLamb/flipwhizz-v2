// src/lib/typeset/runs.ts
//
// Emphasis: which words on a page are set differently (capitals, italic,
// bigger, shouted, or a sound-effect "burst"), the way a picture-book
// designer marks up a manuscript. Pure functions, unit-tested.
//
// The plan is written as the page text with markers, e.g.
//   "The {caps:SCOWLING} Miss Spell took {italic:broomstick} lessons."
// Removing the markers must give back the page text EXACTLY, so a plan can
// never change a single character of what the customer wrote.

export type RunStyle = "plain" | "caps" | "italic" | "big" | "shout" | "burst";
export type Run = { t: string; s: RunStyle };

export const RUN_STYLES: RunStyle[] = ["plain", "caps", "italic", "big", "shout", "burst"];
const MARK_STYLES = new Set<RunStyle>(["caps", "italic", "big", "shout", "burst"]);

/** Stored on story_pages.text_runs. */
export type StoredRuns = { v: 1; forText: string; runs: Run[] };

export function plainRuns(text: string): Run[] {
  return text ? [{ t: text, s: "plain" }] : [];
}

export function runsText(runs: Run[]): string {
  return runs.map((r) => r.t).join("");
}

/** Join neighbours with the same style and drop empty runs. */
export function tidyRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.t) continue;
    const last = out.at(-1);
    if (last && last.s === r.s) last.t += r.t;
    else out.push({ t: r.t, s: r.s });
  }
  return out;
}

/**
 * Parse "{style:words}" markers. Unknown styles, nested or unclosed markers
 * are treated as plain text, so the result always round-trips.
 */
export function parseMarked(marked: string): Run[] {
  const runs: Run[] = [];
  const re = /\{(caps|italic|big|shout|burst):([^{}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(marked))) {
    if (m.index > last) runs.push({ t: marked.slice(last, m.index), s: "plain" });
    runs.push({ t: m[2], s: m[1] as RunStyle });
    last = m.index + m[0].length;
  }
  if (last < marked.length) runs.push({ t: marked.slice(last), s: "plain" });
  return tidyRuns(runs);
}

export function toMarked(runs: Run[]): string {
  return runs.map((r) => (r.s === "plain" ? r.t : `{${r.s}:${r.t}}`)).join("");
}

const wordsIn = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Keep a plan inside the house rules:
 * - at most `maxMarks` marked runs per page (the first ones win)
 * - a mark is at most 4 words and never the whole page
 * - marks don't start or end with spaces (moved out to plain)
 * - "burst" only when allowed (one per spread), otherwise it becomes "shout"
 */
export function enforceBudget(runs: Run[], opts: { maxMarks?: number; allowBurst?: boolean } = {}): Run[] {
  const maxMarks = opts.maxMarks ?? 2;
  const total = runsText(runs).trim();
  let marks = 0;
  let burstUsed = false;
  const out: Run[] = [];
  for (const r of runs) {
    if (r.s === "plain") {
      out.push(r);
      continue;
    }
    // Spaces at the edges of a mark belong to the plain text around it.
    const lead = r.t.match(/^\s*/)![0];
    const trail = r.t.match(/\s*$/)![0];
    const core = r.t.slice(lead.length, r.t.length - trail.length);
    let s: RunStyle = r.s;
    if (!core || wordsIn(core) > 4 || core === total || marks >= maxMarks) s = "plain";
    if (s === "burst" && (opts.allowBurst === false || burstUsed)) s = "shout";
    if (s !== "plain") {
      marks++;
      if (s === "burst") burstUsed = true;
    }
    out.push({ t: lead, s: "plain" }, { t: core, s }, { t: trail, s: "plain" });
  }
  return tidyRuns(out);
}

export function hasBurst(runs: Run[]): boolean {
  return runs.some((r) => r.s === "burst");
}

export function isValidFor(text: string, runs: unknown): runs is Run[] {
  return (
    Array.isArray(runs) &&
    runs.every((r) => r && typeof r.t === "string" && RUN_STYLES.includes(r.s)) &&
    runsText(runs as Run[]) === text
  );
}

/** The runs to use for this text: the stored plan if it still matches, else plain. */
export function runsFor(text: string, stored: unknown): Run[] {
  const s = stored as StoredRuns | null | undefined;
  if (s && s.forText === text && isValidFor(text, s.runs)) return s.runs;
  return plainRuns(text);
}

export function isStale(text: string, stored: unknown): boolean {
  const s = stored as StoredRuns | null | undefined;
  return !s || s.forText !== text || !isValidFor(text, s.runs);
}

export function isMark(style: RunStyle): boolean {
  return MARK_STYLES.has(style);
}

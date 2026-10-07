// src/lib/illustrate/plan.ts
//
// Pure decision logic: turn a vision inspection into a list of fixes.
// No I/O, unit-tested.

import { isValidBox2d, type Box2d } from "./geometry";

export type CastRef = {
  id: string;
  name: string;
  species: string | null; // "human", "dog", ...
  breed: string | null;
  line: string; // character-sheet text
  sheetUrl: string | null; // reference sheet (face + full body)
  cardUrl: string | null; // character card portrait
  photoUrl: string | null; // real reference photo
};

export type InspectedPerson = {
  characterId: string | null;
  name: string;
  box_2d: Box2d;
  matches: boolean;
  isDuplicate: boolean;
  issues: string[];
};

export type InspectReport = {
  people: InspectedPerson[];
  missing: string[]; // characterIds expected but not found
};

export type CropFix =
  | { kind: "likeness"; characterId: string; box_2d: Box2d; issues: string[] }
  | { kind: "replace"; characterId: string; box_2d: Box2d; replacing: string }
  | { kind: "remove"; box_2d: Box2d; duplicateOf: string; reason?: "duplicate" | "not-in-scene" };

export type FixPlan = {
  clean: boolean;
  add: string[]; // characterIds to add with a whole-picture edit
  crops: CropFix[];
  summary: string[]; // human-readable list of what is wrong
};

/**
 * Normalise a raw vision reply: keep valid boxes, map names to ids, force at
 * most one non-duplicate per character, recompute "missing".
 */
export function normaliseReport(raw: any, cast: CastRef[], expectedIds: string[]): InspectReport {
  const byId = new Map(cast.map((c) => [c.id, c]));
  const byName = new Map(cast.map((c) => [c.name.trim().toLowerCase(), c]));

  const people: InspectedPerson[] = [];
  const list = Array.isArray(raw?.people) ? raw.people : Array.isArray(raw) ? raw : [];
  for (const p of list) {
    if (!isValidBox2d(p?.box_2d)) continue;
    let id: string | null = typeof p.characterId === "string" && byId.has(p.characterId) ? p.characterId : null;
    if (!id && typeof p.name === "string") id = byName.get(p.name.trim().toLowerCase())?.id ?? null;
    people.push({
      characterId: id,
      name: id ? byId.get(id)!.name : String(p.name ?? "unknown"),
      box_2d: p.box_2d as Box2d,
      matches: p.matches === true,
      isDuplicate: p.isDuplicate === true,
      issues: Array.isArray(p.issues) ? p.issues.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim()) : [],
    });
  }

  // Exactly one "original" per character: if the model marked none or
  // several, keep the best (matches, then fewest issues, then biggest).
  const area = (b: Box2d) => (b[2] - b[0]) * (b[3] - b[1]);
  const groups = new Map<string, InspectedPerson[]>();
  for (const p of people) {
    if (!p.characterId) continue;
    groups.set(p.characterId, [...(groups.get(p.characterId) ?? []), p]);
  }
  for (const list of groups.values()) {
    if (list.length === 1) {
      list[0].isDuplicate = false;
      continue;
    }
    const best = [...list].sort(
      (a, b) =>
        Number(b.matches) - Number(a.matches) ||
        a.issues.length - b.issues.length ||
        area(b.box_2d) - area(a.box_2d)
    )[0];
    for (const p of list) p.isDuplicate = p !== best;
  }

  const present = new Set(people.filter((p) => p.characterId && !p.isDuplicate).map((p) => p.characterId!));
  const missing = expectedIds.filter((id) => byId.has(id) && !present.has(id));
  return { people, missing };
}

export function planFixes(
  report: InspectReport,
  cast: CastRef[],
  opts: {
    focusIds?: string[];
    forbiddenIds?: string[];
    minHeight?: number;
    maxCrops?: number;
    /** Covers may show the same character twice on purpose (front and back). */
    allowDuplicates?: boolean;
  } = {}
): FixPlan {
  const nameOf = (id: string) => cast.find((c) => c.id === id)?.name ?? id;
  const focus = opts.focusIds?.length ? new Set(opts.focusIds) : null;
  const inFocus = (id: string | null) => !focus || (id !== null && focus.has(id));
  const minHeight = opts.minHeight ?? 45; // 4.5% of picture height (0-1000 scale)
  const maxCrops = opts.maxCrops ?? 8;

  const summary: string[] = [];
  const crops: CropFix[] = [];
  const missing = report.missing.filter((id) => inFocus(id));

  // Duplicates: turn each into a missing character if one is needed, else remove.
  for (const p of report.people.filter((q) => q.isDuplicate && q.characterId && !opts.allowDuplicates)) {
    if (!inFocus(p.characterId)) continue;
    const want = missing.shift();
    if (want) {
      crops.push({ kind: "replace", characterId: want, box_2d: p.box_2d, replacing: p.characterId! });
      summary.push(`${p.name} drawn twice; replacing the extra one with ${nameOf(want)}`);
    } else {
      crops.push({ kind: "remove", box_2d: p.box_2d, duplicateOf: p.characterId! });
      summary.push(`${p.name} drawn twice; removing the extra one`);
    }
  }

  // Characters the scene says must NOT be in this picture.
  const forbidden = new Set(opts.forbiddenIds ?? []);
  for (const p of report.people) {
    if (!p.characterId || p.isDuplicate || !forbidden.has(p.characterId) || !inFocus(p.characterId)) continue;
    const want = missing.shift();
    if (want) {
      crops.push({ kind: "replace", characterId: want, box_2d: p.box_2d, replacing: p.characterId });
      summary.push(`${p.name} should not be here; replacing with ${nameOf(want)}`);
    } else {
      crops.push({ kind: "remove", box_2d: p.box_2d, duplicateOf: p.characterId, reason: "not-in-scene" });
      summary.push(`${p.name} should not be in this picture; removing`);
    }
  }

  // Likeness fixes.
  for (const p of report.people) {
    if (!p.characterId || (p.isDuplicate && !opts.allowDuplicates) || p.matches || p.issues.length === 0) continue;
    if (forbidden.has(p.characterId)) continue;
    if (!inFocus(p.characterId)) continue;
    const h = p.box_2d[2] - p.box_2d[0];
    if (h < minHeight) continue; // too small to show the difference
    crops.push({ kind: "likeness", characterId: p.characterId, box_2d: p.box_2d, issues: p.issues });
    summary.push(`${p.name}: ${p.issues.join("; ")}`);
  }

  for (const id of missing) summary.push(`${nameOf(id)} is missing`);

  // Duplicates / replacements first: they matter most.
  const order = { replace: 0, remove: 1, likeness: 2 } as const;
  crops.sort((a, b) => order[a.kind] - order[b.kind]);

  const capped = crops.slice(0, maxCrops);
  return {
    clean: capped.length === 0 && missing.length === 0,
    add: missing,
    crops: capped,
    summary,
  };
}

/**
 * Split crop fixes into waves whose (grown) boxes don't overlap, so fixes in
 * a wave can run in parallel without one paste undoing another.
 */
// grow matches the widest area a person fix may paste (adaptive mask limit).
export function wavesOf<T extends { box_2d: Box2d }>(fixes: T[], grow = 0.5): T[][] {
  const grown = (b: Box2d) => {
    const gy = (b[2] - b[0]) * grow;
    const gx = (b[3] - b[1]) * grow;
    return [b[0] - gy, b[1] - gx, b[2] + gy, b[3] + gx];
  };
  const overlaps = (a: Box2d, b: Box2d) => {
    const [ay0, ax0, ay1, ax1] = grown(a);
    const [by0, bx0, by1, bx1] = grown(b);
    return ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1;
  };
  const waves: T[][] = [];
  for (const f of fixes) {
    const wave = waves.find((w) => w.every((g) => !overlaps(g.box_2d, f.box_2d)));
    if (wave) wave.push(f);
    else waves.push([f]);
  }
  return waves;
}

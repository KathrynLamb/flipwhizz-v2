/* ======================================================
   STEP KEY TYPE
====================================================== */

export type StepKey =
  | "write"
  | "design"
  | "characters"
  | "locations"
  | "preview"
  | "pay"
  | "studio"
  | "cover"
  | "print";

/* ======================================================
   STEP ORDER — single source of truth
   Must match UnifiedStoryHeader's STEP_ORDER
====================================================== */

export const STEP_ORDER: StepKey[] = [
  "write",
  "design",
  "characters",
  "locations",
  "preview",
  "pay",
  "studio",
  "cover",
  "print",
];

/* ======================================================
   STEP → URL mapping
====================================================== */

export const STEP_HREF: Record<StepKey, (id: string) => string> = {
  write: (id) => `/stories/${id}/pages`,
  design: (id) => `/stories/${id}/illustration-style`,
  characters: (id) => `/stories/${id}/characters`,
  locations: (id) => `/stories/${id}/locations`,
  preview: (id) => `/stories/${id}/preview`,
  pay: (id) => `/stories/${id}/checkout`,
  studio: (id) => `/stories/${id}/studio`,
  cover: (id) => `/stories/${id}/cover`,
  print: (id) => `/stories/${id}/print`,
};

/* ======================================================
   NUMBER ↔ KEY CONVERTERS
   Used by the layout where currentStep is stored as a
   number in the DB.
====================================================== */

/**
 * Convert a 1-based step number to a StepKey.
 * Falls back to "write" for out-of-range or undefined values.
 */
export function stepNumberToKey(step?: number | null): StepKey {
  if (step == null || step < 1 || step > STEP_ORDER.length) return "write";
  return STEP_ORDER[step - 1];
}

/**
 * Convert an array that may contain step numbers (as numbers)
 * or step key strings into a clean StepKey[].
 * Handles mixed arrays gracefully.
 */
export function stepNumbersToKeys(steps: (string | number)[]): StepKey[] {
  const valid = new Set<string>(STEP_ORDER);
  const result: StepKey[] = [];

  for (const s of steps) {
    if (typeof s === "string" && valid.has(s)) {
      result.push(s as StepKey);
    } else if (typeof s === "number") {
      const key = stepNumberToKey(s);
      if (!result.includes(key)) result.push(key);
    }
  }

  return result;
}

/* ======================================================
   RESOLVE NEXT INCOMPLETE STEP

   Derives extra completions the same way UnifiedStoryHeader
   does, then returns the first step not yet done.
====================================================== */

export function getNextIncompleteStep(story: {
  completed_steps?: StepKey[] | null;
  completedSteps?: StepKey[] | null;
  story_confirmed?: boolean;
  storyConfirmed?: boolean;
  payment_status?: string | null;
  paymentStatus?: string | null;
  cover_spread_url?: string | null;
  coverSpreadUrl?: string | null;
}): StepKey {
  // Support both snake_case (API response) and camelCase (direct DB)
  const raw = story.completed_steps ?? story.completedSteps ?? [];
  const done = new Set<StepKey>(raw);

  if (story.story_confirmed ?? story.storyConfirmed) done.add("write");
  if ((story.payment_status ?? story.paymentStatus) === "paid") done.add("pay");
  if (story.cover_spread_url ?? story.coverSpreadUrl) done.add("cover");

  for (const step of STEP_ORDER) {
    if (!done.has(step)) return step;
  }

  return "print";
}

/* ======================================================
   CONVENIENCE: get the URL for the next incomplete step
====================================================== */

export function getNextStepHref(
  storyId: string,
  story: Parameters<typeof getNextIncompleteStep>[0]
): string {
  const step = getNextIncompleteStep(story);
  return STEP_HREF[step](storyId);
}
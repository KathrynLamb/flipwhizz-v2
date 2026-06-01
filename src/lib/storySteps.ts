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
  write:     (id) => `/stories/${id}/pages`,
  design:    (id) => `/stories/${id}/illustration-style`,
  characters:(id) => `/stories/${id}/characters`,
  locations: (id) => `/stories/${id}/locations`,
  preview:   (id) => `/stories/${id}/preview`,
  pay:       (id) => `/stories/${id}/checkout`,
  studio:    (id) => `/stories/${id}/studio`,
  cover:     (id) => `/stories/${id}/cover`,
  print:     (id) => `/stories/${id}/print`,
};

/* ======================================================
   NUMBER ↔ KEY CONVERTERS
====================================================== */

export function stepNumberToKey(step?: number | null): StepKey {
  if (step == null || step < 1 || step > STEP_ORDER.length) return "write";
  return STEP_ORDER[step - 1];
}

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
   STORY SHAPE (shared by helpers below)
====================================================== */

type StoryRoutingFields = {
  completed_steps?: StepKey[] | null;
  completedSteps?: StepKey[] | null;
  story_confirmed?: boolean;
  storyConfirmed?: boolean;
  payment_status?: string | null;
  paymentStatus?: string | null;
  cover_spread_url?: string | null;
  coverSpreadUrl?: string | null;
};

/* ======================================================
   PAYMENT STATUS HELPER

   "paid"    — PayPal succeeded, digital unlocked
   "gifted"  — promo/free order, digital unlocked
   "failed"  — PayPal succeeded but Gelato order failed;
               digital is still valid, customer stays in
               the post-pay flow and can retry printing
====================================================== */

function resolvePaymentStatus(story: StoryRoutingFields): string | null {
  return story.payment_status ?? story.paymentStatus ?? null;
}

/** True for any status that means the customer has paid and is past the checkout step */
function isPostPayment(status: string | null): boolean {
  return status === "paid" || status === "gifted" || status === "failed";
}

/* ======================================================
   RESOLVE NEXT INCOMPLETE STEP
====================================================== */

export function getNextIncompleteStep(story: StoryRoutingFields): StepKey {
  const raw = story.completed_steps ?? story.completedSteps ?? [];
  const done = new Set<StepKey>(raw);

  if (story.story_confirmed ?? story.storyConfirmed) done.add("write");

  // Mark pay as done for any post-payment status — including failed Gelato orders
  if (isPostPayment(resolvePaymentStatus(story))) done.add("pay");

  if (story.cover_spread_url ?? story.coverSpreadUrl) done.add("cover");

  for (const step of STEP_ORDER) {
    if (!done.has(step)) return step;
  }

  return "print";
}

/* ======================================================
   PRIMARY ROUTING HELPER — use this everywhere

   Post-payment stories always go to /book regardless of
   which steps are technically "complete" in the DB.
   All other stories route to the next incomplete step.
====================================================== */

export function getStoryHref(
  storyId: string,
  story: StoryRoutingFields
): string {
  if (isPostPayment(resolvePaymentStatus(story))) {
    return `/stories/${storyId}/book`;
  }
  if (story.cover_spread_url ?? story.coverSpreadUrl) {
    return `/stories/${storyId}/book`;
  }
  return getNextStepHref(storyId, story);
}

/* ======================================================
   CONVENIENCE: URL for next incomplete step
   (use getStoryHref instead for card/library routing)
====================================================== */

export function getNextStepHref(
  storyId: string,
  story: StoryRoutingFields
): string {
  const step = getNextIncompleteStep(story);
  return STEP_HREF[step](storyId);
}
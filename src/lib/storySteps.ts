// src/lib/storySteps.ts

export const STEP_ORDER = [
    "write",
    "extract",
    "design",
    "locations",
    "studio",
    "print",
  ] as const;
  
  export type StepKey = (typeof STEP_ORDER)[number];
  
  export function stepNumberToKey(step?: number | null): StepKey {
    if (!step) return "write";
    return STEP_ORDER[Math.max(0, step - 1)] ?? "write";
  }
  
  
  export function stepNumbersToKeys(steps?: number[]): StepKey[] {
    if (!Array.isArray(steps)) return [];
    return steps
      .map(n => STEP_ORDER[n - 1])
      .filter(Boolean);
  }
  
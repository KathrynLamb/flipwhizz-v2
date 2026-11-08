// src/lib/christmas-delivery.ts
import { CHRISTMAS, formatChristmasDate } from "./christmas";

export const CHRISTMAS_LATE_WARNING = "This won't arrive before Christmas. Choose the digital edition or a gift card instead.";

export function christmasDelivery(productType: string, bookType = "storybook", now: Date = new Date()) {
  if (!CHRISTMAS.enabled || now.getTime() >= Date.parse(CHRISTMAS.endsAt)) return null;
  if (productType === "digital") return {
    late: false, cutoff: null,
    message: "No postal wait. Your digital edition is ready to download once your book is finished.",
    estimate: "Allow time to write, illustrate and review your book before Christmas.",
  };
  if (productType !== "print" && productType !== "gift") return null;
  const colouring = bookType === "colouring_storybook";
  const cutoff = colouring ? CHRISTMAS.colouringCutoff : CHRISTMAS.printCutoff;
  const late = now.getTime() >= Date.parse(cutoff);
  return {
    late, cutoff,
    message: late ? CHRISTMAS_LATE_WARNING : `Christmas ordering cut-off: ${formatChristmasDate(cutoff)}. Finish, approve and submit your book to print by this date.`,
    // Keep the existing storybook estimate. Lulu supplies no arrival quote here.
    estimate: colouring
      ? "An arrival estimate is not available yet for this colouring book. Allow time for printing and post."
      : "Estimated delivery: 5 to 7 business days after submission to print. This is an estimate, not a Christmas delivery guarantee.",
  };
}

// src/lib/admin/catalog.ts
//
// Every admin action on a book, in one list: its words, how much protection
// it needs on a customer's book, and whether it changes pictures. Shared by
// the Book page (buttons, confirm dialogs) and the action API (which
// enforces the same rules on the server). No server imports: safe in the
// browser.

export type ActionKey =
  | "redraw-spread"
  | "fix-character-spread"
  | "refresh-character"
  | "redraw-sheet"
  | "draw-missing"
  | "redraw-all"
  | "replan-all"
  | "redraw-cover"
  | "copy-to-me"
  | "apply-to-original"
  | "restore-snapshot"
  | "stop"
  | "re-extract"
  | "fix-status"
  | "make-pdf-preview"
  | "make-print-pdf"
  | "use-pdf"
  | "test-print-order";

/** How hard it is to press on a customer's book. Test copies only ever need a plain confirm. */
export type Safeguard = "none" | "confirm" | "confirm-snapshot" | "type-title-snapshot";

export type ActionInfo = {
  label: string;
  detail: string;
  safeguard: Safeguard;
  /** Changes pictures: a snapshot is taken first, on every book. */
  snapshot: boolean;
  /** Refused while the book is busy (a whole-book run is going). */
  locks: boolean;
  /** Runs in the background and keeps the book busy until it reports back. */
  long: boolean;
  /** Uses the image model picker. */
  usesModel?: boolean;
};

export const ACTIONS: Record<ActionKey, ActionInfo> = {
  "redraw-spread": {
    label: "Redraw this spread",
    detail: "Draws this spread again, then checks and fixes every character and letters the text. Add a note to change something specific instead of starting fresh.",
    safeguard: "confirm",
    snapshot: true,
    locks: false,
    long: false,
    usesModel: true,
  },
  "fix-character-spread": {
    label: "Fix one character on this spread",
    detail: "Finds that character on this spread and redraws only them from their reference sheet. Everything else, lettering included, stays as it is.",
    safeguard: "confirm",
    snapshot: true,
    locks: false,
    long: true,
    usesModel: true,
  },
  "refresh-character": {
    label: "Update one character on every page",
    detail: "After changing a character's card or photo: redraws only that character on every page they appear on. About one or two image calls per page.",
    safeguard: "type-title-snapshot",
    snapshot: true,
    locks: true,
    long: true,
    usesModel: true,
  },
  "redraw-sheet": {
    label: "Redraw reference sheet",
    detail: "Throws away this character's reference sheet for this book and draws a new one from their card and photo. Pages don't change until they're redrawn.",
    safeguard: "none",
    snapshot: false,
    locks: false,
    long: false,
    usesModel: true,
  },
  "draw-missing": {
    label: "Draw missing pages only",
    detail: "Only spreads without a picture. Never touches a finished page.",
    safeguard: "none",
    snapshot: false,
    locks: true,
    long: true,
    usesModel: true,
  },
  "redraw-all": {
    label: "Redraw every page (same scene plans)",
    detail: "Keeps the current scene plans; draws, checks, fixes and letters every spread.",
    safeguard: "type-title-snapshot",
    snapshot: true,
    locks: true,
    long: true,
    usesModel: true,
  },
  "replan-all": {
    label: "Re-plan scenes and redraw every page",
    detail: "Re-plans who is in each scene, rewrites the art direction and rebuilds reference sheets, then draws, checks, fixes and letters every spread.",
    safeguard: "type-title-snapshot",
    snapshot: true,
    locks: true,
    long: true,
    usesModel: true,
  },
  "redraw-cover": {
    label: "Redraw the cover",
    detail: "Uses the saved cover plan, then checks and fixes every character on it.",
    safeguard: "confirm-snapshot",
    snapshot: true,
    locks: true,
    long: true,
    usesModel: false,
  },
  "copy-to-me": {
    label: "Copy to my account",
    detail: "Makes a test copy of this whole book in your account: pages, pictures, characters, scene plans, cover. The original isn't touched.",
    safeguard: "none",
    snapshot: false,
    locks: false,
    long: false,
  },
  "apply-to-original": {
    label: "Apply this copy's pictures to the original",
    detail: "Moves this copy's page pictures and cover onto the original book, matched by page number, plus character cards and scene plans where every name matches. The original is snapshotted first.",
    safeguard: "type-title-snapshot",
    snapshot: true,
    locks: true,
    long: false,
  },
  "restore-snapshot": {
    label: "Restore this snapshot",
    detail: "Puts every page picture, check record and the cover back as they were. The current state is snapshotted first, so this can be undone too.",
    safeguard: "confirm",
    snapshot: true,
    locks: true,
    long: false,
  },
  stop: {
    label: "Stop runs for this book",
    detail: "Cancels every drawing job for this book. Anything already saved stays; nothing half-finished is saved.",
    safeguard: "none",
    snapshot: false,
    locks: false,
    long: false,
  },
  "re-extract": {
    label: "Re-extract characters",
    detail: "Reads the story text again and adds any named character that's missing from this book. Existing characters aren't changed.",
    safeguard: "confirm",
    snapshot: false,
    locks: true,
    long: false,
  },
  "fix-status": {
    label: "Fix stuck status",
    detail: "Sets the book's status by hand when a job died and left it stuck. Doesn't start or stop anything.",
    safeguard: "confirm",
    snapshot: false,
    locks: false,
    long: false,
  },
  "make-pdf-preview": {
    label: "Make a preview PDF",
    detail: "Builds the whole book exactly as it would print: cover, every page, at Gelato's sizes. Only for you to look at: it isn't saved on the book, sent to Gelato or shown to the customer. Pages without a picture yet show as grey placeholders.",
    safeguard: "none",
    snapshot: false,
    locks: false,
    long: false,
  },
  "make-print-pdf": {
    label: "Make the print PDF",
    detail: "Builds the whole book and saves it as this book's print PDF: the file new print orders send to Gelato. Orders already placed keep the PDF they were sent with. Needs the cover and every page drawn.",
    safeguard: "confirm",
    snapshot: false,
    locks: true,
    long: false,
  },
  "use-pdf": {
    label: "Make this the print PDF",
    detail: "Saves this PDF as the book's print PDF (the file new print orders send to Gelato) without building it again. Use it to keep a preview you've checked, or to go back to an earlier print PDF. Orders already placed keep theirs.",
    safeguard: "confirm",
    snapshot: false,
    locks: true,
    long: false,
  },
  "test-print-order": {
    label: "Place a test print order",
    detail: "Sends this book's PDF to Gelato as a REAL, PAID print order, shipped to your address.",
    safeguard: "confirm",
    snapshot: false,
    locks: false,
    long: false,
  },
};

export const ACTION_KEYS = Object.keys(ACTIONS) as ActionKey[];

export function isActionKey(v: unknown): v is ActionKey {
  return typeof v === "string" && v in ACTIONS;
}

/** Statuses "Fix stuck status" may set, with what each means. */
export const BOOK_STATUSES: { value: string; meaning: string }[] = [
  { value: "paged", meaning: "Story split into pages. Nothing planned or drawn yet." },
  { value: "ready", meaning: "Characters, places and scenes are planned. Pages can be drawn." },
  { value: "generating", meaning: "Pages are being drawn right now." },
  { value: "covers_complete", meaning: "Pages and cover are done." },
];

/* -------------------------------------------------------------------------- */
/*                                 Book kinds                                 */
/* -------------------------------------------------------------------------- */

export type BookKind = "customer-paid" | "customer-unpaid" | "test-copy";

export const KIND_INFO: Record<BookKind, { label: string; className: string }> = {
  "customer-paid": { label: "Customer · paid", className: "bg-rose-500/15 text-rose-200 border-rose-400/40" },
  "customer-unpaid": { label: "Customer · unpaid", className: "bg-amber-500/15 text-amber-200 border-amber-400/40" },
  "test-copy": { label: "Test copy", className: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40" },
};

export function bookKind(o: { ownerIsAdmin: boolean; isCopy: boolean; paymentStatus: string | null }): BookKind {
  if (o.isCopy || o.ownerIsAdmin) return "test-copy";
  return o.paymentStatus === "paid" ? "customer-paid" : "customer-unpaid";
}

/** What the confirm dialog must ask for, given the book. */
export function confirmNeeded(action: ActionKey, kind: BookKind): "none" | "confirm" | "type-title" {
  const s = ACTIONS[action].safeguard;
  if (s === "none") return "none";
  if (kind === "test-copy") return "confirm";
  return s === "type-title-snapshot" ? "type-title" : "confirm";
}

/** Same comparison on both sides: case and spacing don't matter. */
export function titleMatches(typed: string | null | undefined, title: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return !!typed && norm(typed) === norm(title);
}

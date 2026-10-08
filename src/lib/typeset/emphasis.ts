// src/lib/typeset/emphasis.ts
//
// Claude decides which few words get emphasis, reading the whole book at
// once so the loud moments are saved for where they matter. Everything it
// returns is checked: the text must come back character for character, and
// the house rules (src/lib/typeset/runs.ts) are enforced on top.

import Anthropic from "@anthropic-ai/sdk";
import { enforceBudget, hasBurst, parseMarked, plainRuns, runsText, type Run } from "./runs";

export const EMPHASIS_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }));

export type EmphasisPage = { pageId: string; n: number; spread: number; text: string };

const SYSTEM = `You are the typographic designer of a children's picture book. The text is set in one book typeface. Your job is to mark the few words a designer would set differently, the way published picture books do: sparingly, so each change feels deliberate.

Styles:
- caps: a word said loudly or with weight, set in capitals at the same size. Example: The teachers were {caps:grumpy}.
- italic: movement, softness, a whisper, or a word read with feeling. Example: She went {italic:gliding} over the roofs.
- big: a single size word or punchline that should look the part. Example: And down came the kite, all the way {big:down}.
- shout: a shouted exclamation of 1 to 3 words, bold capitals. Example: "{shout:Stop right there!}" yelled Gran.
- burst: a sound effect or exclamation that stands alone, drawn big and bouncy on its own line. Example: {burst:SPLASH!} Into the pond went Dad.

Rules:
- Mark words exactly as they appear. Never add, remove or change a single character, space or punctuation mark. Do not fix spelling.
- Most pages have no marks. Never more than 2 marks on a page. A mark is at most 4 words.
- At most one burst per spread (two facing pages), and bursts on no more than 1 spread in 4. A burst must be a sound or exclamation that already stands as its own word or sentence in the text.
- Never mark names unless they are shouted. Never mark a whole sentence.
- Prefer the moments a child would read out loud with the most expression.

Format: copy each page's text and wrap the marked words like {caps:GRUMPY} or {italic:gliding} or {burst:SPLASH!}. Write the words inside the braces exactly as they are in the text (keep their original capitalisation; the typesetter applies capitals).

Return JSON only: {"pages":[{"n":1,"marked":"..."}]} with every page you were given, in order.`;

function parseReply(text: string): { n: number; marked: string }[] {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  const data = tryParse(cleaned) ?? tryParse(cleaned.match(/\{[\s\S]*\}/)?.[0] ?? "");
  const list = Array.isArray(data?.pages) ? data.pages : [];
  return list.filter((p: any) => typeof p?.n === "number" && typeof p?.marked === "string");
}

/**
 * Turn the model's marked pages into runs, page by page, enforcing every
 * rule. Pages it got wrong (or left out) come back plain. Exported for tests.
 */
export function runsFromReply(
  pages: EmphasisPage[],
  reply: { n: number; marked: string }[],
  /** When planning part of a book: how many spreads it has, and how many of the others already have a burst. */
  book: { totalSpreads?: number; burstSpreadsElsewhere?: number } = {}
): Map<string, Run[]> {
  const byN = new Map(reply.map((r) => [r.n, r.marked]));
  const out = new Map<string, Run[]>();

  // Spreads that may keep a burst: no more than one spread in four across
  // the book (at least one), counting bursts already on other spreads.
  const spreads = [...new Set(pages.map((p) => p.spread))];
  const total = Math.max(spreads.length, book.totalSpreads ?? 0);
  const maxBurstSpreads = Math.max(1, Math.floor(total / 4)) - (book.burstSpreadsElsewhere ?? 0);
  const burstSpreads = new Set<number>();

  for (const p of [...pages].sort((a, b) => a.n - b.n)) {
    const marked = byN.get(p.n);
    let runs = marked ? parseMarked(marked) : plainRuns(p.text);
    if (runsText(runs) !== p.text) {
      // The model changed the words: ignore its marks for this page.
      runs = plainRuns(p.text);
    }
    const spreadHasBurst = burstSpreads.has(p.spread);
    const canStartBurst = !spreadHasBurst && burstSpreads.size < maxBurstSpreads;
    runs = enforceBudget(runs, { allowBurst: canStartBurst });
    if (hasBurst(runs)) burstSpreads.add(p.spread);
    // A spread with a burst on its other page: this page can't have one too.
    if (spreadHasBurst) runs = enforceBudget(runs, { allowBurst: false });
    out.set(p.pageId, runs);
  }
  return out;
}

export async function planEmphasis(
  pages: EmphasisPage[],
  ctx: { title?: string; totalSpreads?: number; burstSpreadsElsewhere?: number } = {}
): Promise<Map<string, Run[]>> {
  const withText = pages.filter((p) => p.text.trim());
  if (withText.length === 0) return new Map();
  const book = withText.map((p) => `PAGE ${p.n} (spread ${p.spread}):\n${p.text}`).join("\n\n");
  const res = await anthropic().messages.create({
    model: EMPHASIS_MODEL,
    max_tokens: 12000,
    system: SYSTEM,
    messages: [{ role: "user", content: `${ctx.title ? `Book: ${ctx.title}\n\n` : ""}${book}` }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return runsFromReply(withText, parseReply(text), { totalSpreads: ctx.totalSpreads, burstSpreadsElsewhere: ctx.burstSpreadsElsewhere });
}

// src/app/api/stories/[id]/global-rewrite/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories, storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { extractInsightsFromRewriteChat } from "@/lib/extractRewriteInsights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MAX_GLOBAL_REWRITE_PAGES = 40;

function log(...args: any[]) {
  console.log("[global-rewrite]", ...args);
}

function extractClaudeText(content: unknown): string {
  const blocks = Array.isArray(content) ? content : [];
  return blocks
    .map((b: any) => (b?.type === "text" && typeof b?.text === "string" ? b.text : ""))
    .filter((t: string) => t.trim().length > 0)
    .join("\n")
    .trim();
}

function extractJson(raw: string): string {
  if (!raw) return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }
  return raw.trim();
}

async function repairJsonWithClaude(raw: string, pageCount: number) {
  const SYSTEM = `You are a JSON repair assistant. Output ONLY valid JSON.

Target shape:
{
  "pages": [
    { "page": 1, "text": "..." },
    ...
    { "page": ${pageCount}, "text": "..." }
  ]
}

RULES:
- Exactly ${pageCount} pages.
- Replace internal double quotes with single quotes.
- 1–4 short sentences per page.
- No markdown, no commentary.`;

  const completion = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    system: SYSTEM,
    max_tokens: 2200,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: "Repair this into valid JSON:\n\n" + raw,
      },
      { role: "assistant", content: "{" },
    ],
  });

  const txt = extractClaudeText(completion.content).trim();
  return txt.startsWith("{") ? txt : `{${txt}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const started = Date.now();

  try {
    const { id: storyId } = await context.params;

    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    const { instruction } = await request.json();
    if (!instruction?.trim()) {
      return NextResponse.json({ error: "Missing instruction" }, { status: 400 });
    }

    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const pages = await db
      .select()
      .from(storyPages)
      .where(eq(storyPages.storyId, storyId))
      .orderBy(asc(storyPages.pageNumber));

    const pageCount = pages.length || story.length || 24;

    if (pageCount > MAX_GLOBAL_REWRITE_PAGES) {
      return NextResponse.json(
        { error: `Global rewrite capped at ${MAX_GLOBAL_REWRITE_PAGES} pages.` },
        { status: 400 }
      );
    }

    const storyTextForModel = pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    log("storyId", storyId, "pageCount", pageCount, "instructionLen", instruction.length);

    // ── System prompt — accepts full conversation as instruction ──
    const SYSTEM = `You are FlipWhizz — a children's story editor.

You will rewrite the entire story based on the editing conversation below.

The instruction is a conversation between the parent and their co-author. Read the FULL conversation to understand the intent. The final agreed direction is what matters — apply ALL discussed changes faithfully.

Some changes are small (a name swap). Some are global (all pronouns neutral). Some are structural (rebuild around phonics). Some are tonal (make it funnier). Apply whatever was discussed. Check EVERY page against the discussed intent.

KEEP:
- The same characters (unless the conversation changes them)
- The same overall plot (unless the conversation changes it)
- Suitable for ages 3–8
- Photo-book page style

OUTPUT ONLY valid JSON:
{
  "pages": [
    { "page": 1, "text": "..." },
    ...
    { "page": ${pageCount}, "text": "..." }
  ]
}

JSON SAFETY:
- No double quotes inside page text. Use single quotes for dialogue.
- All "text" values must be valid JSON strings.

RULES:
- Exactly ${pageCount} pages.
- 1–4 short sentences per page.
- No markdown, no commentary, no backticks.
- Sequential page numbers 1..${pageCount}.
- No titles or extra fields.`;

    const modelCallStarted = Date.now();

    let completion;
    try {
      completion = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        system: SYSTEM,
        max_tokens: 3500,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content:
              `CURRENT STORY:\n\n${storyTextForModel}\n\n` +
              `EDITING CONVERSATION:\n\n${instruction}\n\n` +
              `Apply all discussed changes. Return ONLY the JSON.`,
          },
          { role: "assistant", content: "{" },
        ],
      });
    } catch (err: any) {
      log("Anthropic call FAILED", err?.status, err?.message);
      return NextResponse.json(
        { error: "Anthropic request failed", details: err?.message ?? String(err) },
        { status: 500 }
      );
    }

    log("Anthropic OK in ms", Date.now() - modelCallStarted);

    let raw = extractClaudeText(completion.content);
    raw = extractJson(raw);

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      log("JSON parse failed → LLM repair");
      const repaired = await repairJsonWithClaude(raw, pageCount);
      raw = extractJson(repaired);
      try {
        json = JSON.parse(raw);
      } catch {
        log("LLM repair failed");
        return NextResponse.json(
          { error: "Claude returned invalid JSON" },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(json.pages)) {
      return NextResponse.json({ error: "JSON missing pages array" }, { status: 500 });
    }

    const byNum = new Map<number, string>();
    for (const p of json.pages) {
      const n = Number(p.page);
      if (!Number.isFinite(n)) continue;
      byNum.set(n, String(p.text ?? "").trim());
    }

    const normalized = Array.from({ length: pageCount }, (_, i) => ({
      id: uuid(),
      storyId,
      pageNumber: i + 1,
      text: byNum.get(i + 1) ?? "",
      illustrationPrompt: null,
      imageId: null,
      createdAt: new Date(),
    }));

    await db.transaction(async (tx) => {
      await tx
        .update(stories)
        .set({ fullDraft: raw, length: pageCount, updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      await tx.delete(storyPages).where(eq(storyPages.storyId, storyId));
      await tx.insert(storyPages).values(normalized);
    });

    log("DONE total ms", Date.now() - started);

    // ── Fire-and-forget: extract insights from the editing conversation ──
    if (story.readerId) {
      extractInsightsFromRewriteChat(story.readerId, storyId, instruction).catch(
        (err) => console.warn("⚠️ Post-rewrite insight extraction failed:", err)
      );
    }

    return NextResponse.json({ ok: true, pagesRewritten: pageCount });
  } catch (err) {
    log("Unhandled error", err);
    return NextResponse.json(
      { error: "Global rewrite failed", details: String(err) },
      { status: 500 }
    );
  }
}
// src/app/api/stories/[id]/global-rewrite/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories, storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

  // ```json ... ``` fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  // first {...} block
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

async function repairJsonWithClaude(raw: string, pageCount: number) {
  const SYSTEM = `
You are a JSON repair assistant.

You MUST output ONLY valid JSON and nothing else.

Target shape:
{
  "pages": [
    { "page": 1, "text": "..." },
    ...
    { "page": ${pageCount}, "text": "..." }
  ]
}

CRITICAL RULES:
- Exactly ${pageCount} pages.
- The "text" values must be valid JSON strings.
- If the source contains double quotes inside story text, you MUST replace them with single quotes.
- Do NOT include any unescaped double quotes inside "text".
- 1–4 short sentences per page.
- No markdown, no commentary, no backticks.
- Do not add extra fields.
`;

  const completion = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    system: SYSTEM,
    max_tokens: 2200,
    temperature: 0,
    messages: [
      {
        role: "user",
        content:
          "Repair this into valid JSON matching the required shape.\n" +
          "Replace any internal double quotes in page text with single quotes.\n\n" +
          raw,
      },
      // Prefill helps Claude “continue” JSON
      { role: "assistant", content: "{" },
    ],
  });

  const txt = extractClaudeText(completion.content);
  const trimmed = txt.trim();
  // ensure it starts with "{"
  return trimmed.startsWith("{") ? trimmed : `{${trimmed}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const started = Date.now();

  try {
    const { id: storyId } = await context.params;
    console.log("Story id", storyId)

    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    const { instruction } = await request.json();
    console.log("instruction", instruction)
    if (!instruction?.trim()) {
      return NextResponse.json({ error: "Missing instruction" }, { status: 400 });
    }

    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1)
      .then((rows) => rows[0]);

      console.log("Story ", story)

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const pages = await db
      .select()
      .from(storyPages)
      .where(eq(storyPages.storyId, storyId))
      .orderBy(asc(storyPages.pageNumber));

      console.log("Pages ", pages)

    const pageCount = pages.length || story.length || 24;
    console.log("Page count ", pageCount)

    if (pageCount > MAX_GLOBAL_REWRITE_PAGES) {
      return NextResponse.json(
        {
          error: `Global rewrite is capped at ${MAX_GLOBAL_REWRITE_PAGES} pages.`,
          details:
            `This story currently has ${pageCount} pages. ` +
            `Consider recreating with a print-safe page count (e.g., 30).`,
        },
        { status: 400 }
      );
    }

    const storyTextForModel = pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    log("storyId", storyId);
    log("pageCount", pageCount);
    log("instructionLen", instruction.length);
    log("pagesInDb", pages.length);
    log("inputCharLen", storyTextForModel.length);

    const SYSTEM = `
You are FlipWhizz — a children's story editor.

You will rewrite the entire story to match the user's instruction,
while keeping:
- the same characters
- the same overall plot intent unless the instruction changes it
- suitable for ages 3–8
- photo-book page style

You MUST output ONLY valid JSON and nothing else.

MANDATORY OUTPUT SHAPE:
{
  "pages": [
    { "page": 1, "text": "..." },
    ...
    { "page": ${pageCount}, "text": "..." }
  ]
}

CRITICAL JSON SAFETY:
- Do NOT use double quotes inside any page text.
- If dialogue is needed, use single quotes or rewrite without quotes.
- Ensure all "text" values are valid JSON strings.

RULES:
- Exactly ${pageCount} pages.
- 1–4 short sentences per page.
- No markdown, no commentary, no backticks.
- Keep page numbers sequential 1..${pageCount}.
- Do not add titles or extra fields.
`;

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
              `Here is the current story:\n\n${storyTextForModel}\n\n` +
              `Rewrite instruction:\n${instruction}\n\n` +
              `Return ONLY the JSON.`,
          },
          { role: "assistant", content: "{" },
        ],
      });
    } catch (err: any) {

      log("Anthropic call FAILED after ms", Date.now() - modelCallStarted);
      log("Anthropic error status", err?.status);
      log("Anthropic error message", err?.message);
      return NextResponse.json(
        {
          error: "Anthropic request failed",
          details: err?.message ?? String(err),
          status: err?.status,
        },
        { status: 500 }
      );
    }

    log("Anthropic call OK in ms", Date.now() - modelCallStarted);

    let raw = extractClaudeText(completion.content);
    raw = extractJson(raw);
    log("rawLen", raw.length);

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      log("JSON parse failed -> attempting LLM repair");
      const repaired = await repairJsonWithClaude(raw, pageCount);
      raw = extractJson(repaired);

      try {
        json = JSON.parse(raw);
      } catch {
        log("LLM repair failed");
        return NextResponse.json(
          {
            error: "Claude returned invalid JSON",
            debug:
              process.env.NODE_ENV !== "production"
                ? { rawPreview: raw.slice(0, 600) }
                : undefined,
          },
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
      const t = String(p.text ?? "").trim();
      byNum.set(n, t);
    }

    const normalized = Array.from({ length: pageCount }, (_, i) => {
      const pageNum = i + 1;
      return {
        id: uuid(),
        storyId,
        pageNumber: pageNum,
        text: byNum.get(pageNum) ?? "",
        illustrationPrompt: null,
        imageId: null,
        createdAt: new Date(),
      };
    });

    // NOTE:
// This route intentionally does NOT update stories.status.
// Workflow progression is handled exclusively via
// POST /api/stories/[id]/status after user confirmation.


    await db.transaction(async (tx) => {
      await tx
        .update(stories)
        .set({
          fullDraft: raw,
          length: pageCount,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      await tx.delete(storyPages).where(eq(storyPages.storyId, storyId));
      await tx.insert(storyPages).values(normalized);
    });

    log("DONE total ms", Date.now() - started);

    return NextResponse.json({
      ok: true,
      pagesRewritten: pageCount,
    });
  } catch (err) {
    log("Unhandled error", err);
    return NextResponse.json(
      { error: "Global rewrite failed", details: String(err) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  chatSessions,
  chatMessages,
  stories,
  storyIntent,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

/* ======================================================
   CLIENT
====================================================== */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* ======================================================
   HELPERS
====================================================== */

function extractJsonFromClaude(response: any) {
  console.log("🧪 RAW CLAUDE CONTENT BLOCKS:", response.content);

  const text = (Array.isArray(response.content) ? response.content : [])
    .map((b: any) => {
      if (b?.type === "text") return String(b.text ?? "");
      return "";
    })
    .join("\n")
    .trim();

  console.log("🧪 CONCATENATED TEXT:", text || "[EMPTY]");

  if (!text) {
    throw new Error("EMPTY_TEXT");
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("NO_JSON_OBJECT_FOUND");
  }

  const jsonString = cleaned.slice(firstBrace, lastBrace + 1);

  console.log("🧪 EXTRACTED JSON STRING:", jsonString);

  return JSON.parse(jsonString);
}

/* ======================================================
   ROUTE
====================================================== */

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  console.log("🟣 DERIVE-INTENT START", { storyId });

  /* -------------------- Validate story -------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true, projectId: true },
  });

  if (!story) {
    console.error("🔴 STORY NOT FOUND", storyId);
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  console.log("🟢 STORY OK", story);

  /* -------------------- Load chat history -------------------- */

  const session = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.projectId, story.projectId))
    .then((r) => r[0]);

  if (!session) {
    console.warn("🟠 NO CHAT SESSION FOR PROJECT", story.projectId);
    return NextResponse.json(
      { error: "No chat session found for this story" },
      { status: 400 }
    );
  }

  console.log("🟢 CHAT SESSION FOUND", session.id);

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, session.id))
    .orderBy(asc(chatMessages.createdAt));

  console.log("🟢 CHAT MESSAGE COUNT", messages.length);

  if (messages.length === 0) {
    console.warn("🟠 EMPTY CHAT HISTORY");
    return NextResponse.json(
      { error: "No chat history available" },
      { status: 400 }
    );
  }

  const claudeMessages = messages.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.content ?? "",
  }));

  console.log("🧠 CLAUDE CONTEXT MESSAGES", claudeMessages);

  /* -------------------- Claude prompt -------------------- */

  const SYSTEM = `
You are a backend analysis function.

You must return ONLY valid JSON.
No commentary. No markdown. No prose.

Task:
Infer WHY this story was created from the conversation.
Focus on motive, emotional intent, and social context.

Return EXACTLY this JSON shape:

{
  "primaryPurpose": "",
  "intendedRecipient": "",
  "emotionalTone": [],
  "occasion": null,
  "permanenceLevel": "playful | keepsake | legacy",
  "thingsToEmphasise": [],
  "thingsToAvoid": [],
  "authorPerspective": ""
}

JSON ONLY.
`.trim();

  console.log("🟢 SYSTEM PROMPT READY");

  /* -------------------- Claude call -------------------- */

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: SYSTEM,
      messages: [
        ...claudeMessages,
        {
          role: "user",
          content:
            "Based on the conversation above, derive the author's intent and return ONLY the JSON object.",
        },
      ],
    });
  } catch (err) {
    console.error("🔴 CLAUDE REQUEST FAILED", err);
    throw err;
  }

  console.log("🟣 CLAUDE RESPONSE META", {
    model: response.model,
    stop_reason: response.stop_reason,
    usage: response.usage,
    contentLength: response.content?.length ?? 0,
  });

  /* -------------------- Parse or fallback -------------------- */

  let parsed;

  try {
    if (!response.content || response.content.length === 0) {
      throw new Error("EMPTY_RESPONSE");
    }

    parsed = extractJsonFromClaude(response);
    console.log("✅ INTENT PARSED SUCCESSFULLY", parsed);
  } catch (err: any) {
    console.warn("🟠 FALLBACK INTENT USED", err.message);

    parsed = {
      primaryPurpose: "Personal storytelling",
      intendedRecipient: "Family or close relations",
      emotionalTone: ["warm", "reflective"],
      occasion: null,
      permanenceLevel: "keepsake",
      thingsToEmphasise: ["authenticity", "emotional truth"],
      thingsToAvoid: ["over-dramatisation", "generic sentiment"],
      authorPerspective: "Author telling a meaningful personal story",
    };
  }

  /* -------------------- Persist intent -------------------- */

  await db
    .insert(storyIntent)
    .values({
      id: uuid(),
      storyId,
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: storyIntent.storyId,
      set: {
        ...parsed,
        updatedAt: new Date(),
      },
    });

  console.log("🟢 INTENT UPSERTED", parsed);

  return NextResponse.json({
    ok: true,
    intent: parsed,
  });
}

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import type { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";

import { db } from "@/db";
import { coverChatSessions, coverChatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const TOOL_NAME = "emit_cover_patch";

/* --------------------------------------------------
   Small deep merge helper
-------------------------------------------------- */
/* --------------------------------------------------
   Small deep merge helper (JSON-safe)
-------------------------------------------------- */
function deepMerge(
  base: Record<string, any>,
  patch: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = { ...base };

  for (const key of Object.keys(patch)) {
    const value = patch[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(
        (base[key] as Record<string, any>) ?? {},
        value
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}


/* ======================================================
   ROUTE — REFINE
====================================================== */

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "Missing sessionId or message" },
        { status: 400 }
      );
    }

    const session = await db.query.coverChatSessions.findFirst({
      where: eq(coverChatSessions.id, sessionId),
    });

    if (!session || !session.coverPlan) {
      return NextResponse.json(
        { error: "Cover plan not found" },
        { status: 404 }
      );
    }

    /* ---------------- Save user message ---------------- */

    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId,
      role: "user",
      content: message,
      createdAt: new Date(),
    });

    /* ---------------- Claude = ART DIRECTOR ---------------- */

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      system: `
You are an expert children's book art director.

You already have a complete wrap-around cover plan.

Your job now is to:
- Discuss the plan conversationally
- Explain design decisions when helpful
- Ask ONE clarifying or confirmation question at a time
- Suggest optional refinements

Only apply changes IF the user explicitly requests a change.

If changes are requested:
- Emit the SMALLEST POSSIBLE PATCH
- Do NOT restate the full plan
- Explain what changed in plain language

If no changes are requested:
- Respond conversationally
- DO NOT emit a patch
`.trim(),
      tools: [
        {
          name: TOOL_NAME,
          description: "Emit a minimal patch to the existing cover plan.",
          input_schema: {
            type: "object",
            required: ["message", "patch"],
            properties: {
              message: { type: "string" },
              patch: { type: "object", additionalProperties: true },
            },
          },
        },
      ],
      tool_choice: { type: "auto" },

      messages: [
        {
          role: "user",
          content: `
CURRENT COVER PLAN:
${JSON.stringify(session.coverPlan, null, 2)}

USER MESSAGE:
${message}
`,
        },
      ],
    });

    /* ---------------- Parse Claude response ---------------- */

    const toolBlock = response.content.find(
      (b: any) => b.type === "tool_use" && b.name === TOOL_NAME
    );

    // 🟢 CASE 1: Conversational reply only (NO PATCH)
// 🟢 CASE 1: Conversational reply only (NO PATCH)
if (!toolBlock) {
  const textBlock = response.content.find(
    (b): b is TextBlock => b.type === "text"
  );

  const textReply =
    textBlock?.text ??
    "Sounds good — let me know what you'd like to adjust.";

  await db.insert(coverChatMessages).values({
    id: uuid(),
    sessionId,
    role: "assistant",
    content: textReply,
    createdAt: new Date(),
  });

  return NextResponse.json({
    reply: textReply,
    coverPlan: session.coverPlan,
  });
}

// 🟢 CASE 2: Patch emitted
const toolUseBlock = toolBlock as ToolUseBlock;

const { message: reply, patch } = toolUseBlock.input as {
  message: string;
  patch: Record<string, any>;
};

const mergedPlan = deepMerge(session.coverPlan as any, patch ?? {});

await db
  .update(coverChatSessions)
  .set({
    coverPlan: mergedPlan,
    planUpdatedAt: new Date(),
  })
  .where(eq(coverChatSessions.id, sessionId));

await db.insert(coverChatMessages).values({
  id: uuid(),
  sessionId,
  role: "assistant",
  content: reply,
  createdAt: new Date(),
});

return NextResponse.json({
  reply,
  coverPlan: mergedPlan,
});

  } catch (err: any) {
    console.error("Cover refine error", err);
    return NextResponse.json(
      { error: "Cover refine failed", detail: err.message },
      { status: 500 }
    );
  }
}

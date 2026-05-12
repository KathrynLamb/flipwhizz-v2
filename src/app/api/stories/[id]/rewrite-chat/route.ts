// src/app/api/stories/[id]/rewrite-chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  storyEditSessions,
  storyEditMessages,
  chatSessions,
  chatMessages,
  stories,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const maxDuration = 30; // web search adds latency

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-6"; // ✅ updated — sonnet-4-20250514 retires June 15

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: storyId } = await context.params;

    const body = await request.json();
    const {
      message,
      conversationHistory,
      currentSpread,
      storyContext,
    }: {
      message: string;
      conversationHistory: any[];
      currentSpread: {
        pages: Array<{ pageNumber?: number; text?: string | null }>;
      };
      storyContext: {
        title: string;
        allPages?: Array<{ pageNumber: number; text: string }>;
      };
    } = body;

    // ── Persist: get or create edit session ──
    let session = await db
      .select()
      .from(storyEditSessions)
      .where(eq(storyEditSessions.storyId, storyId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session) {
      const sessionId = uuid();
      const now = new Date();
      await db.insert(storyEditSessions).values({
        id: sessionId,
        storyId,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
      session = { id: sessionId, storyId, lastMessageAt: now, createdAt: now, updatedAt: now };
    }

    // ── Save user message ──
    await db.insert(storyEditMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "user",
      content: message,
      createdAt: new Date(),
    });

    // ── Load original creation chat for background context ──
    // The parent told the creation AI about their child, the story, characters etc.
    // We inject this so the co-author never has to ask again.
    let creationChatSummary = "";
    try {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { projectId: true },
      });

      if (story?.projectId) {
        const creationSession = await db.query.chatSessions.findFirst({
          where: eq(chatSessions.projectId, story.projectId),
        });

        if (creationSession) {
          const originalMessages = await db
            .select({ role: chatMessages.role, content: chatMessages.content })
            .from(chatMessages)
            .where(eq(chatMessages.sessionId, creationSession.id))
            .orderBy(asc(chatMessages.createdAt));

          if (originalMessages.length > 0) {
            creationChatSummary =
              "\n\nORIGINAL CREATION CONVERSATION (what the parent told us before the first draft):\n" +
              originalMessages
                .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
                .join("\n\n") +
              "\n\nUse this as background. Never ask for information already shared here.";
          }
        }
      }
    } catch (err) {
      console.warn("Could not load creation chat context:", err);
    }
    const spreadContext = currentSpread?.pages?.length
      ? `\nCURRENT SPREAD (Pages ${currentSpread.pages[0]?.pageNumber ?? "?"}–${currentSpread.pages[1]?.pageNumber ?? "?"}):\nLEFT: ${currentSpread.pages[0]?.text || "(blank)"}\nRIGHT: ${currentSpread.pages[1]?.text || "(blank)"}`
      : "";

    const systemPrompt = `You are a co-author chat assistant helping a parent refine their children's book "${storyContext.title}".
${spreadContext}${creationChatSummary}

RESPONSE LENGTH — HARD RULE:
1-3 sentences maximum. Never more. No lists. No bullet points. No headers. Just a short, direct conversational reply.

NEVER WRITE PAGE CONTENT IN CHAT:
Never write rewritten pages, revised text, or story content in your reply. The rewrite happens when the parent clicks "Apply Changes" — not here. If you've figured out what to change, confirm it in one sentence and stop. Example: "Got it — I'll swap Burnley for Sunderland throughout and update the manager to Kim Hellberg." That's it. Don't write it out.

YOUR ROLE:
- Discuss changes conversationally. One question if needed, one confirmation when ready.
- If the request is clear, confirm what you'll do and stop.
- If the request is broad, ask ONE clarifying question only.
- Never ask for information already shared in the original creation conversation above.

WEB SEARCH:
- Search for real-world facts when needed (fixtures, results, managers, players).
- After searching, use what you found in a single brief confirmation. Don't list everything you found.

IMPORTANT:
- Never be precious about the draft.
- If the parent reveals something new about their child, acknowledge it in one sentence.`;

    const messages = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300, // short chat replies only — rewrites happen via Apply Changes
      system: systemPrompt,
      // ✅ web search — lets Claude look up real fixtures, managers, players etc
      tools: [
        {
          type: "web_search_20250305" as any,
          name: "web_search",
        },
      ],
      messages: messages as any,
    });

    // Extract text blocks only — web search tool_use/tool_result blocks are filtered out
    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("\n")
      .trim();

    // ── Save assistant reply ──
    await db.insert(storyEditMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

    // ── Update session timestamp ──
    await db
      .update(storyEditSessions)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(storyEditSessions.id, session.id));

    const updatedHistory = [
      ...messages,
      { role: "assistant", content: reply },
    ];

    return NextResponse.json({
      reply,
      conversationHistory: updatedHistory,
    });
  } catch (error) {
    console.error("Rewrite chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
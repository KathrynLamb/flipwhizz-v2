// app/api/stories/[storyId]/cover-chat/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { coverChatSessions, coverChatMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    // Find session
    const session = await db
      .select()
      .from(coverChatSessions)
      .where(eq(coverChatSessions.storyId, storyId))
      .then((rows) => rows[0]);

    if (!session) {
      return NextResponse.json({ messages: [] });
    }

    // Load messages
    const messages = await db
      .select()
      .from(coverChatMessages)
      .where(eq(coverChatMessages.sessionId, session.id))
      .orderBy(asc(coverChatMessages.createdAt));

    return NextResponse.json({
      sessionId: session.id,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
  } catch (err) {
    console.error("Load cover chat history error:", err);
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
}
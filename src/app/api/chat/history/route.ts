import { NextResponse } from "next/server";
import { db } from "@/db";
import { chatSessions, chatMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    // 1. Find the chat session for this project
    const session = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.projectId, projectId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session) {
      return NextResponse.json({
        sessionId: null,
        messages: [],
      });
    }

    // 2. Load all messages for the session
    const messages = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session.id))
      .orderBy(chatMessages.createdAt); // chronological

    return NextResponse.json({
      sessionId: session.id,
      messages,
    });
  } catch (err) {
    console.error("Error loading chat history:", err);
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
}

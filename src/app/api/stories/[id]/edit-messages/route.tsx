// app/api/stories/[id]/edit-messages/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyEditSessions, storyEditMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  try {
    // Get or create session
    let session = await db.query.storyEditSessions.findFirst({
      where: eq(storyEditSessions.storyId, storyId),
    });

    if (!session) {
      // No session exists yet, return empty
      return NextResponse.json({
        sessionId: null,
        messages: [],
      });
    }

    // Get all messages for this session
    const messages = await db
      .select({
        id: storyEditMessages.id,
        role: storyEditMessages.role,
        content: storyEditMessages.content,
        createdAt: storyEditMessages.createdAt,
      })
      .from(storyEditMessages)
      .where(eq(storyEditMessages.sessionId, session.id))
      .orderBy(asc(storyEditMessages.createdAt));

    return NextResponse.json({
      sessionId: session.id,
      messages,
    });
  } catch (error) {
    console.error("Error loading edit messages:", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const { role, content } = await req.json();

  if (!role || !content) {
    return NextResponse.json(
      { error: "Missing role or content" },
      { status: 400 }
    );
  }

  try {
    // Get or create session
    let session = await db.query.storyEditSessions.findFirst({
      where: eq(storyEditSessions.storyId, storyId),
    });

    if (!session) {
      const [newSession] = await db
        .insert(storyEditSessions)
        .values({
          storyId,
          lastMessageAt: new Date(),
        })
        .returning();
      session = newSession;
    } else {
      // Update last message time
      await db
        .update(storyEditSessions)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(storyEditSessions.id, session.id));
    }

    // Save message
    const [message] = await db
      .insert(storyEditMessages)
      .values({
        sessionId: session.id,
        role,
        content,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      message,
    });
  } catch (error) {
    console.error("Error saving edit message:", error);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}
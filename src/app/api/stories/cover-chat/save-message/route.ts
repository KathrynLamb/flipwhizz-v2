// app/api/stories/cover-chat/save-message/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { coverChatSessions, coverChatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function POST(req: Request) {
  try {
    const { storyId, role, content } = await req.json();

    if (!storyId || !role || !content) {
      return NextResponse.json(
        { error: "storyId, role, and content are required" },
        { status: 400 }
      );
    }

    if (role !== "user" && role !== "assistant") {
      return NextResponse.json(
        { error: "role must be 'user' or 'assistant'" },
        { status: 400 }
      );
    }

    // Find existing session
    let session = await db
      .select()
      .from(coverChatSessions)
      .where(eq(coverChatSessions.storyId, storyId))
      .then((r) => r[0]);

    // Create session if it doesn't exist
    if (!session) {
      const [created] = await db
        .insert(coverChatSessions)
        .values({
          id: uuid(),
          storyId,
          createdAt: new Date(),
        })
        .returning();
      session = created;
    }

    // Save the message
    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role,
      content,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Save cover chat message error:", err);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}
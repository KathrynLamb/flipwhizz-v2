// src/app/api/stories/cover-chat/save-message/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { coverConversations } from "@/db/schema";

export async function POST(req: Request) {
  try {
    const { storyId, role, content } = await req.json();

    if (!storyId || !role || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await db.insert(coverConversations).values({
      storyId,
      role,
      content,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ [save-message]", err);
    return NextResponse.json(
      { error: err.message || "Failed to save message" },
      { status: 500 }
    );
  }
}
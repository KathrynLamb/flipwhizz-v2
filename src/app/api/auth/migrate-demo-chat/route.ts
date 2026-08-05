// /api/auth/migrate-demo-chat/route.ts
// Call immediately after successful sign-in to attach demo session to user

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { chatSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { demoSessionId } = await req.json();

    if (!demoSessionId) {
      return NextResponse.json(
        { error: "Missing demoSessionId" },
        { status: 400 }
      );
    }

    // Attach the demo session to this user
    // This single update links all messages in that session to the user
    const result = await db
      .update(chatSessions)
      .set({ userId: session.user.id })
      .where(eq(chatSessions.id, demoSessionId as any));

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[migrate-demo-chat] error:", error);
    return NextResponse.json(
      { error: "Migration failed" },
      { status: 500 }
    );
  }
}
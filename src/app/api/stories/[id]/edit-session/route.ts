import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyEditSessions, storyEditMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { withAccess } from "@/lib/authz";

async function _GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  try {
    const session = await db.query.storyEditSessions.findFirst({
      where: eq(storyEditSessions.storyId, storyId),
    });

    if (!session) {
      return NextResponse.json({ messages: [] });
    }

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

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error loading edit session:", error);
    return NextResponse.json(
      { error: "Failed to load session" },
      { status: 500 }
    );
  }
}

export const GET = withAccess({ story: { param: "id" } }, _GET);

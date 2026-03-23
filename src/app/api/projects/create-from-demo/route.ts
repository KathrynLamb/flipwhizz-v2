import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { v4 as uuid } from "uuid";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { projects, chatSessions, chatMessages } from "@/db/schema";

type DemoMsg = {
  role: "user" | "assistant";
  content: string;
};

function isValidMessageArray(value: unknown): value is DemoMsg[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (msg) =>
        msg &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string"
    )
  );
}

function makeProjectName(messages: DemoMsg[]) {
  const firstUser = messages.find((m) => m.role === "user")?.content?.trim();

  if (!firstUser) return "My Story Project";

  const cleaned = firstUser
    .replace(/\s+/g, " ")
    .replace(/[^\w\s'-]/g, "")
    .trim();

  if (!cleaned) return "My Story Project";

  return cleaned.length > 48
    ? `${cleaned.slice(0, 45).trim()}...`
    : cleaned;
}

function buildStoryBrief(messages: DemoMsg[]) {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Please sign in to continue and create your book.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const messages = body?.messages;

    if (!isValidMessageArray(messages)) {
      return NextResponse.json(
        { error: "Invalid demo messages." },
        { status: 400 }
      );
    }

    const now = new Date();
    const projectId = uuid();
    const chatSessionId = uuid();

    const projectName = makeProjectName(messages);
    const storyBrief = buildStoryBrief(messages);

    await db.insert(projects).values({
      id: projectId,
      userId: session.user.id,
      name: projectName,
      storyBrief,
    });

    await db.insert(chatSessions).values({
      id: chatSessionId,
      projectId,
      userId: session.user.id,
      readerId: null,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
    });

    await db.insert(chatMessages).values(
      messages.map((msg, index) => ({
        id: uuid(),
        sessionId: chatSessionId,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(now.getTime() + index),
      }))
    );

    return NextResponse.json({ projectId });
  } catch (error) {
    console.error("[create-from-demo] error:", error);

    return NextResponse.json(
      { error: "Could not create project from demo." },
      { status: 500 }
    );
  }
}
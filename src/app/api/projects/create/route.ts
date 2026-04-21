import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, storyProducts } from "@/db/schema";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { v4 as uuid } from "uuid";
import { captureServerEvent } from "@/lib/posthog-server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, intent } = await req.json();

  if (!title || title.trim().length === 0) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const projectId = uuid();

  await db.insert(projects).values({
    id: projectId,
    userId: session.user.id,
    name: title,
    storyBrief: null,
    storyBasePrompt: null,
    fullAiStory: null,
    purchaseIntent: intent || null,
  });

  await captureServerEvent(session.user.id, "project_created", {
    project_id: projectId,
    title,
    purchase_intent: intent || null,
  });

  return NextResponse.json({ id: projectId });
}
// src/app/api/cover/generate/route.ts
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { coverChatSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { requireStoryOwner } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { storyId, sessionId } = await req.json();
    console.log('storyId, sessionId', storyId, sessionId)
    if (!storyId || !sessionId) {
      return NextResponse.json(
        { error: "Missing storyId or sessionId" },
        { status: 400 }
      );
    }

    const ownerCheck = await requireStoryOwner(storyId);
    if (!ownerCheck.ok) return ownerCheck.response;

    const session = await db.query.coverChatSessions.findFirst({
      where: eq(coverChatSessions.id, sessionId),
    });

    // The cover session must belong to the story we just authorised
    if (session && session.storyId !== storyId) {
      return NextResponse.json({ error: "Cover session not found" }, { status: 404 });
    }


    if (!session || !session.coverPlan) {
      return NextResponse.json(
        { error: "Cover plan not ready" },
        { status: 400 }
      );
    }

    const plan = session.coverPlan as any;
    console.log('plan', plan)
    const requiredVisuals = [
      plan.frontVisual,
      plan.spineVisual,
      plan.backVisual,
    ].every(Boolean);

    if (!requiredVisuals) {
      return NextResponse.json(
        {
          error: "Cover plan incomplete",
          missing: plan.questionsNeeded ?? [],
        },
        { status: 400 }
      );
    }

    const generationId = uuid();

    await inngest.send({
      name: "cover/generate",
      data: {
        storyId,
        generationId,
        coverPlan: plan,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: generationId,
    });
  } catch (err) {
    console.error("❌ Cover generation error:", err);
    return NextResponse.json(
      { error: "Failed to start cover generation" },
      { status: 500 }
    );
  }
}

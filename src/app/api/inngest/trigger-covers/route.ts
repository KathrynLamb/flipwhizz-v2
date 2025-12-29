import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { storyId } = await req.json();

    if (!storyId) {
      return NextResponse.json(
        { error: "storyId is required" },
        { status: 400 }
      );
    }

    // Trigger the Inngest function
    await inngest.send({
      name: "story/generate.covers",
      data: { storyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to trigger cover generation:", error);
    return NextResponse.json(
      { error: "Failed to trigger cover generation" },
      { status: 500 }
    );
  }
}
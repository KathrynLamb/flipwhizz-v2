import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { v4 as uuid } from "uuid";

export async function POST(req: Request) {
  try {
    const { storyId, storyTitle, chatHistory } = await req.json();

    if (!storyId || !storyTitle) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    console.log("i am in cover generate", storyId, storyTitle, chatHistory )
    // Generate unique job ID
    const jobId = uuid();

    // Extract cover design brief from chat history
    const conversationSummary = chatHistory
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // Queue Inngest job
    await inngest.send({
      name: "cover/generate",
      data: {
        storyId,
        storyTitle,
        coverBrief: conversationSummary,
        jobId,
      },
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: "Cover generation started",
    });
  } catch (err) {
    console.error("Cover generation error:", err);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}
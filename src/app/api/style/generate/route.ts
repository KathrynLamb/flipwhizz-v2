import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storyId } = body;

    if (!storyId) return NextResponse.json({ error: "No Story ID" }, { status: 400 });

    // ⚡️ Send to background queue instantly
    await inngest.send({
      name: "style/generate.sample",
      data: body,
    });

    return NextResponse.json({ 
      success: true, 
      message: "Generation queued" 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
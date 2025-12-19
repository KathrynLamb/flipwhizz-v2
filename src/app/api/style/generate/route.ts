import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      storyId,
      description,
      leftText,
      rightText,
      references,
    } = body;

    if (!storyId) {
      return NextResponse.json({ error: "No storyId" }, { status: 400 });
    }

    if (!Array.isArray(references)) {
      return NextResponse.json(
        { error: "Invalid references payload" },
        { status: 400 }
      );
    }

    // 🔒 Contract enforcement
    for (const ref of references) {
      if (ref.type === "character") {
        const hasImage = typeof ref.url === "string";
        const hasDesc = typeof ref.description === "string";

        if (hasImage && hasDesc) {
          return NextResponse.json(
            { error: "Character reference cannot include both image and description" },
            { status: 400 }
          );
        }

        if (!hasImage && !hasDesc) {
          return NextResponse.json(
            { error: "Character reference missing image or description" },
            { status: 400 }
          );
        }
      }
    }

    // ⚡️ Send to background queue
    await inngest.send({
      name: "style/generate.sample",
      data: body,
    });

    return NextResponse.json({
      success: true,
      message: "Generation queued",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

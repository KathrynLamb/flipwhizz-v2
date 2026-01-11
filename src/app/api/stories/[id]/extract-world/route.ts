import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  await inngest.send({
    name: "story/extract-world",
    data: { storyId },
  });

  

  return NextResponse.json({
    ok: true,
    message: "World extraction started",
  });
}

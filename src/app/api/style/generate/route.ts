import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

/**
 * STYLE SAMPLE GENERATION
 * -----------------------
 * This endpoint:
 * 1. Validates payload + references contract
 * 2. Generates a generationId
 * 3. Queues a background Inngest job
 *
 * Logs are intentionally verbose.
 */

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎨 [STYLE GENERATE] Incoming request");
  console.log("🆔 requestId:", requestId);

  try {
    /* ------------------------------------
       Parse body
    ------------------------------------ */
    const body = await req.json();

    console.log("📦 Raw body:", JSON.stringify(body, null, 2));

    const {
      storyId,
      description,
      leftText,
      rightText,
      references,
    } = body;

    /* ------------------------------------
       Validate storyId
    ------------------------------------ */
    if (!storyId) {
      console.error("❌ Missing storyId");
      return NextResponse.json(
        { error: "No storyId" },
        { status: 400 }
      );
    }

    console.log("📘 storyId:", storyId);

    /* ------------------------------------
       Validate references array
    ------------------------------------ */
    if (!Array.isArray(references)) {
      console.error("❌ references is not an array:", references);
      return NextResponse.json(
        { error: "Invalid references payload" },
        { status: 400 }
      );
    }

    console.log(`🔗 ${references.length} references received`);

    /* ------------------------------------
       Contract enforcement
    ------------------------------------ */
    for (let i = 0; i < references.length; i++) {
      const ref = references[i];

      console.log(`🔍 Validating reference [${i}]`, ref);

      if (ref.type === "character") {
        const hasImage = typeof ref.url === "string";
        const hasDesc = typeof ref.description === "string";

        console.log(
          `   ↳ character ref — hasImage=${hasImage}, hasDesc=${hasDesc}`
        );

        if (hasImage && hasDesc) {
          console.error(
            "❌ Character reference has BOTH image and description",
            ref
          );
          return NextResponse.json(
            {
              error:
                "Character reference cannot include both image and description",
              index: i,
            },
            { status: 400 }
          );
        }

        if (!hasImage && !hasDesc) {
          console.error(
            "❌ Character reference missing image AND description",
            ref
          );
          return NextResponse.json(
            {
              error:
                "Character reference missing image or description",
              index: i,
            },
            { status: 400 }
          );
        }
      }
    }

    console.log("✅ Reference contract validated");

    /* ------------------------------------
       Generate generationId
    ------------------------------------ */
    const generationId = crypto.randomUUID();

    console.log("🧬 generationId:", generationId);

    /* ------------------------------------
       Queue background job
    ------------------------------------ */
    console.log("🚀 Sending job to Inngest…");

    await inngest.send({
      name: "style/generate.sample",
      data: {
        storyId,
        description,
        leftText,
        rightText,
        references,
        generationId,
        requestId,
        queuedAt: new Date().toISOString(),
      },
    });

    console.log("📬 Inngest job queued successfully");
    console.log("⏱️ Queue latency:", Date.now() - startedAt, "ms");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    /* ------------------------------------
       Response
    ------------------------------------ */
    return NextResponse.json({
      success: true,
      message: "Generation queued",
      generationId,
      requestId,
    });

  } catch (err: any) {
    console.error("💥 [STYLE GENERATE] Fatal error");
    console.error("🆔 requestId:", requestId);
    console.error(err);

    return NextResponse.json(
      {
        error: err?.message ?? "Unknown error",
        requestId,
      },
      { status: 500 }
    );
  }
}

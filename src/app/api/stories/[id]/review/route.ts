// app/api/stories/[id]/review/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, reviews, promoCodes, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ─── Generate a unique promo code ───
function generatePromoCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for readability
  let code = "FLIP";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Main handler ───
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    // Check story exists
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Get userId from the story's project (matches order route pattern)
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, story.projectId),
    });

    const userId = project?.userId ?? "unknown";

    if (userId === "unknown") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for existing review (one per user per story)
    const existingReview = await db.query.reviews.findFirst({
      where: and(eq(reviews.storyId, storyId), eq(reviews.userId, userId)),
    });

    if (existingReview) {
      return NextResponse.json(
        {
          error: "You've already reviewed this book",
          promoCode: existingReview.promoCode,
        },
        { status: 409 }
      );
    }

    // Parse JSON body (media already uploaded via /review/upload)
    const body = await req.json();
    const { rating, responses, permissions, mediaUrls: uploadedMedia } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be 1-5" },
        { status: 400 }
      );
    }

    if (!permissions?.rightToShare) {
      return NextResponse.json(
        { error: "Image sharing permission is required" },
        { status: 400 }
      );
    }

    // Media URLs already uploaded — just validate shape
    const mediaUrls: { url: string; type: "photo" | "video"; cloudinaryPublicId: string }[] =
      (uploadedMedia || []).filter(
        (m: any) => m.url && m.type && m.cloudinaryPublicId
      );

    /* --------------------------------------------------
       2. Generate promo code
    -------------------------------------------------- */

    const code = generatePromoCode();
    const promoCodeId = uuidv4();

    await db.insert(promoCodes).values({
      id: promoCodeId,
      code,
      label: `Review reward – ${story.title?.slice(0, 40)}`,
      discountType: "percent",
      discountPercent: 15,
      maxUses: 1,
      maxUsesPerUser: 1,
      currentUses: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    /* --------------------------------------------------
       3. Create review record
    -------------------------------------------------- */

    const [review] = await db
      .insert(reviews)
      .values({
        storyId,
        userId,
        rating,
        responses,
        mediaUrls,
        permissions,
        promoCodeId,
        promoCode: code,
        published: false, // requires manual moderation
        featured: false,
      })
      .returning({ id: reviews.id });

    console.log(
      `✅ Review created: ${review.id} for story ${storyId} with promo ${code}`
    );

    return NextResponse.json({
      success: true,
      reviewId: review.id,
      promoCode: code,
      mediaCount: mediaUrls.length,
    });
  } catch (err) {
    console.error("❌ Review submission failed:", err);
    return NextResponse.json(
      {
        error: "Failed to submit review",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
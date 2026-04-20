import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { users, stories, storySpreads } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { storyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  // Get user's TikTok token
  const user = await db
    .select({
      tiktokAccessToken: users.tiktokAccessToken,
      tiktokOpenId: users.tiktokOpenId,
      tiktokTokenExpiresAt: users.tiktokTokenExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0]);

  if (!user?.tiktokAccessToken) {
    return NextResponse.json({ error: "tiktok_not_connected" }, { status: 403 });
  }

  if (user.tiktokTokenExpiresAt && user.tiktokTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "tiktok_token_expired" }, { status: 403 });
  }

  // Get story spreads with images, ordered correctly
  const spreads = await db
    .select({
      spreadIndex: storySpreads.spreadIndex,
      leftPageId: storySpreads.leftPageId,
      rightPageId: storySpreads.rightPageId,
    })
    .from(storySpreads)
    .where(eq(storySpreads.storyId, params.storyId))
    .orderBy(asc(storySpreads.spreadIndex));

  // Get the story for the caption
  const story = await db
    .select({ title: stories.title })
    .from(stories)
    .where(eq(stories.id, params.storyId))
    .then((r) => r[0]);

  // Pull image URLs from request body (client passes the Cloudinary URLs
  // it already has — avoids another DB round-trip)
  const { imageUrls, caption } = await req.json() as {
    imageUrls: string[];
    caption?: string;
  };

  if (!imageUrls?.length || imageUrls.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 images for a carousel" },
      { status: 400 }
    );
  }

  // TikTok photo carousel — max 35 images
  const photos = imageUrls.slice(0, 35).map((url) => ({ image_url: url }));

  const postCaption =
    caption ??
    `${story?.title ?? "Our Story"} 📖✨ Created with FlipWhizz #FlipWhizz #PersonalisedBooks #KidsBooks #StoryTime`;

  const tiktokRes = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/content/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.tiktokAccessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: postCaption,
          privacy_level: "SELF_ONLY", // sandbox-safe; change to PUBLIC_TO_EVERYONE for production
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: photos,
        },
        media_type: "PHOTO",
      }),
    }
  );

  const tiktokData = await tiktokRes.json();

  if (tiktokData.error?.code && tiktokData.error.code !== "ok") {
    console.error("TikTok post failed:", tiktokData);
    return NextResponse.json(
      { error: "tiktok_post_failed", detail: tiktokData.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    publishId: tiktokData.data?.publish_id,
  });
}
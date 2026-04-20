import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { users, stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id: storyId } = await params;
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

  // Get story for caption
  const story = await db
    .select({ title: stories.title })
    .from(stories)
    .where(eq(stories.id, storyId))
    .then((r) => r[0]);

  // Image URLs come from the client (already fetched on the page)
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

  const baseUrl = process.env.NEXTAUTH_URL; // https://flipwhizz.com
  const photos = imageUrls.slice(0, 35).map(
    (url) => `${baseUrl}/api/image-proxy?url=${encodeURIComponent(url)}`
  );


  const postCaption =
  caption ??
  `${story?.title ?? "Our Story"} - Created with FlipWhizz`;

    const payload = {
        post_info: {
            title: postCaption,
            privacy_level: "SELF_ONLY",
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
        post_mode: "DIRECT_POST",
      };
      
      console.log("TikTok payload:", JSON.stringify(payload, null, 2));
      console.log("First image URL:", photos[0]?.image_url);
      console.log("Photo count:", photos.length);
      console.log("Caption length:", postCaption.length);

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
          privacy_level: "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 1,  // 1-based per docs
          photo_images: photos,  // array of strings
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),   // ← closes JSON.stringify
    }        // ← closes fetch options object
  );         // ← closes fetch()

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
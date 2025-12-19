// app/api/stories/generate-covers/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { storyId, prompt } = await req.json();

    if (!storyId || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate Front Cover using Gemini
    const frontCoverResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          prompt: prompt.frontCover,
          number_of_images: 1,
          aspect_ratio: "3:4", // Portrait for book cover
          safety_filter_level: "block_some",
          person_generation: "allow_all",
        }),
      }
    );

    if (!frontCoverResponse.ok) {
      const error = await frontCoverResponse.json();
      console.error("Gemini front cover error:", error);
      throw new Error("Failed to generate front cover");
    }

    const frontData = await frontCoverResponse.json();
    const frontImageData = frontData.images?.[0]?.image;

    if (!frontImageData) {
      throw new Error("No front cover image returned");
    }

    // Generate Back Cover using Gemini
    const backCoverResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          prompt: prompt.backCover,
          number_of_images: 1,
          aspect_ratio: "3:4",
          safety_filter_level: "block_some",
          person_generation: "allow_all",
        }),
      }
    );

    if (!backCoverResponse.ok) {
      const error = await backCoverResponse.json();
      console.error("Gemini back cover error:", error);
      throw new Error("Failed to generate back cover");
    }

    const backData = await backCoverResponse.json();
    const backImageData = backData.images?.[0]?.image;

    if (!backImageData) {
      throw new Error("No back cover image returned");
    }

    // TODO: Upload images to your storage (S3, Cloudinary, etc.)
    // For now, we'll return base64 data URLs
    const frontCoverUrl = `data:image/png;base64,${frontImageData}`;
    const backCoverUrl = `data:image/png;base64,${backImageData}`;

    // Save URLs to database
    await db
      .update(stories)
      .set({
        frontCoverUrl,
        backCoverUrl,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return NextResponse.json({
      frontCoverUrl,
      backCoverUrl,
    });
  } catch (err: any) {
    console.error("Generate covers error:", err);
    return NextResponse.json(
      { error: "Failed to generate covers", details: err.message },
      { status: 500 }
    );
  }
}

// Optional: Add a separate endpoint to upload covers to permanent storage
// This would be called after the user approves the covers
export async function uploadCoverToStorage(base64Data: string, storyId: string, type: 'front' | 'back') {
  // Example with Cloudinary or your preferred storage
  const formData = new FormData();
  
  // Convert base64 to blob
  const base64Response = await fetch(base64Data);
  const blob = await base64Response.blob();
  
  formData.append('file', blob);
  formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET!);
  formData.append('folder', `flipwhizz/covers/${storyId}`);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const uploadData = await uploadResponse.json();
  return uploadData.secure_url;
}
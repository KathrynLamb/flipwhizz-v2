// app/api/stories/[id]/narrate/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Default voice — warm, storytelling British female. Change as needed.
// Browse voices at https://elevenlabs.io/voice-library
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // "Sarah"
const MODEL_ID = "eleven_multilingual_v2";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const { text, pageIndex } = await req.json();

    if (!text || pageIndex === undefined) {
      return NextResponse.json(
        { error: "text and pageIndex required" },
        { status: 400 }
      );
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs not configured" },
        { status: 503 }
      );
    }

    // Check if we already have cached audio for this page
    const cacheKey = `flipwhizz/narration/${storyId}/page-${pageIndex}`;

    try {
      const existing = await cloudinary.api.resource(cacheKey, {
        resource_type: "video", // Cloudinary stores audio under "video"
      });
      if (existing?.secure_url) {
        // Serve cached audio
        const audioRes = await fetch(existing.secure_url);
        const audioBuffer = await audioRes.arrayBuffer();
        return new Response(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } catch {
      // Not cached yet — generate fresh
    }

    // Generate audio via ElevenLabs
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.4, // some expressiveness for storytelling
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("❌ ElevenLabs error:", elevenRes.status, errText);
      return NextResponse.json(
        { error: "Narration generation failed" },
        { status: 502 }
      );
    }

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());

    // Cache to Cloudinary (non-blocking — serve audio immediately)
    cloudinary.uploader
      .upload_stream(
        {
          folder: `flipwhizz/narration/${storyId}`,
          public_id: `page-${pageIndex}`,
          resource_type: "video",
          format: "mp3",
          overwrite: true,
        },
        (error) => {
          if (error) console.error("Audio cache upload failed:", error);
          else console.log(`✅ Cached narration: page ${pageIndex}`);
        }
      )
      .end(audioBuffer);

    // Return audio immediately
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("❌ Narration error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import admin from "@/lib/firebase-admin.node";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { adminStorage } from "@/lib/firebase-admin.node";



/* ---------- HEIC HELPERS ---------- */

function isHeic(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function convertHeic(buffer: Buffer) {
  const heicConvert = (await import("heic-convert")).default;

  const output = await heicConvert({
    buffer,
    format: "JPEG",
    quality: 0.9,
  });

  return Buffer.from(output);
}

/* ---------- ROUTE ---------- */

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const characterId = form.get("characterId") as string | null;

    if (!file || !characterId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    let buffer = Buffer.from(await file.arrayBuffer());

    // ✅ HEIC → JPEG
    if (isHeic(file)) {
      buffer = await convertHeic(buffer);
    }

    const bucket = adminStorage;
    const filename = `reference/characters/${characterId}/${uuid()}.jpg`;
    const fileRef = bucket.file(filename);
    
    await fileRef.save(buffer, {
      metadata: {
        contentType: "image/jpeg",
      },
      resumable: false,
    });
    
    await fileRef.makePublic();
    
    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    
    console.log("REFERENCE IMAGE URL:", url);


    // ✅ Save reference ONLY (invalidate portrait)
    await db
      .update(characters)
      .set({
        referenceImageUrl: url,
        portraitImageUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId));

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("CHARACTER UPLOAD ERROR", {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : null,
    });
    
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

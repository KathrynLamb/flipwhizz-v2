import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import admin from "@/lib/firebase-admin";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { adminStorage } from "@/lib/firebase-admin";

export const runtime = "nodejs";

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

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const locationId = form.get("locationId") as string;

    if (!file || !locationId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // ✅ Convert HEIC → JPEG
    if (isHeic(file)) {
      buffer = await convertHeic(buffer);
    }

    const bucket = adminStorage;
    const filename = `reference/locations/${locationId}/${uuid()}.jpg`;
    const fileRef = bucket.file(filename);

    await fileRef.save(buffer, {
      contentType: "image/jpeg",
      public: true,
    });

    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    // ✅ Persist JPEG URL
    await db
      .update(locations)
      .set({
        referenceImageUrl: url,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error("UPLOAD ERROR", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

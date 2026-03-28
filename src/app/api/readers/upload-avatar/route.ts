// src/app/api/readers/upload-avatar/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { readers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const readerId = formData.get("readerId") as string;

  if (!file || !readerId) {
    return NextResponse.json({ error: "Missing file or readerId" }, { status: 400 });
  }

  // Upload to Firebase
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `reader-avatars/${readerId}/${crypto.randomUUID()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, buffer, { contentType: file.type });
  const url = await getDownloadURL(storageRef);

  // Save to reader
  await db
    .update(readers)
    .set({ avatarUrl: url, updatedAt: new Date() })
    .where(eq(readers.id, readerId));

  return NextResponse.json({ ok: true, url });
}
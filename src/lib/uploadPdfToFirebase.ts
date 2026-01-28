export const runtime = "nodejs";

import { v4 as uuidv4 } from "uuid";
import { adminStorage } from "@/lib/firebase-admin.node";

/**
 * Upload a completed story PDF to Firebase Storage
 * Uses the single, canonical Firebase Admin instance
 */
export async function uploadPdfToFirebase(
  buffer: Buffer,
  storyId: string
): Promise<string> {
  const bucket = adminStorage();

  const filePath = `flipwhizz/pdfs/${storyId}/complete-${Date.now()}.pdf`;
  const file = bucket.file(filePath);

  const token = uuidv4();

  await file.save(buffer, {
    metadata: {
      contentType: "application/pdf",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
    resumable: false, // faster + safer for buffers
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    filePath
  )}?alt=media&token=${token}`;

  return url;
}

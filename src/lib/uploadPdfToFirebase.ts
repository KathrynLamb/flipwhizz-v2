import admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

function ensureFirebaseAdmin() {
    if (!admin.apps.length) {
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      if (!clientEmail || !rawKey) {
        throw new Error("Missing Firebase Admin env vars");
      }
  
      // This handles the \n characters correctly if the .env string uses literals
      const privateKey = rawKey.replace(/\\n/g, "\n");
  
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, // Add this explicitly
          clientEmail,
          privateKey,
        }),
        storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET,
      });
    }
}
  

export async function uploadPdfToFirebase(
  buffer: Buffer,
  storyId: string
): Promise<string> {
  ensureFirebaseAdmin();

  const bucket = getStorage().bucket();

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
    resumable: false, // faster for buffers
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    filePath
  )}?alt=media&token=${token}`;

  return url;
}

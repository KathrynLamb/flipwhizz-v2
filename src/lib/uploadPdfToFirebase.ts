import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

function getFirebaseApp(): App {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
  });
}

export async function uploadPdfToFirebase(
  buffer: Buffer,
  storyId: string
): Promise<string> {
  console.log(`📤 Uploading PDF to Firebase: ${storyId} (${buffer.length} bytes)`);

  getFirebaseApp();
  const bucket = getStorage().bucket();
  const filePath = `pdfs/${storyId}/story-${storyId}.pdf`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    contentType: "application/pdf",
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  await file.makePublic();

  const url = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  console.log("✅ PDF uploaded to Firebase:", url);
  return url;
}
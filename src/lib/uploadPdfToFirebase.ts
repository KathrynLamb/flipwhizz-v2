import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

function getFirebaseApp(): App {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET!,
  });
}

export async function uploadPdfToFirebase(
  buffer: Buffer,
  storyId: string
): Promise<string> {
  console.log(`📤 Uploading PDF to Firebase: ${storyId} (${buffer.length} bytes)`);

  console.log("🔑 Firebase env check:", {
    hasProjectId: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    keyStartsWith: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.substring(0, 30),
    keyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length,
  });

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
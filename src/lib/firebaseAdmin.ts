import admin from "firebase-admin";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;

if (!projectId || !clientEmail || !privateKey || !storageBucket) {
  throw new Error(
    `Missing Firebase Admin env vars: ${
      [
        !projectId && "FIREBASE_ADMIN_PROJECT_ID",
        !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
        !privateKey && "FIREBASE_ADMIN_PRIVATE_KEY",
        !storageBucket && "FIREBASE_ADMIN_STORAGE_BUCKET",
      ]
        .filter(Boolean)
        .join(", ")
    }`
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket,
  });
}

export const bucket = admin.storage().bucket();
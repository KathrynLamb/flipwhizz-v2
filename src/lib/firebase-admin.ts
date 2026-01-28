import admin from "firebase-admin";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;

if (!projectId || !clientEmail || !rawPrivateKey || !storageBucket) {
  throw new Error("Missing Firebase Admin environment variables");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
    }),
    storageBucket,
  });
}

export const adminStorage = admin.storage().bucket();

export default admin;

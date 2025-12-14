// src/lib/firebase-admin.ts
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

if (!process.env.FIREBASE_ADMIN_PROJECT_ID) throw new Error("Missing FIREBASE_ADMIN_PROJECT_ID");
if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL) throw new Error("Missing FIREBASE_ADMIN_CLIENT_EMAIL");
if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) throw new Error("Missing FIREBASE_ADMIN_PRIVATE_KEY");

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n");

const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET,
  });

export const adminStorage = getStorage(app);
export const adminBucket = adminStorage.bucket();

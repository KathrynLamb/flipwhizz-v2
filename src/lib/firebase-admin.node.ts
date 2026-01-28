import admin from "firebase-admin";

const base64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;

if (!base64) {
  throw new Error("Missing FIREBASE_ADMIN_CREDENTIALS_BASE64");
}

const credentials = JSON.parse(
  Buffer.from(base64, "base64").toString("utf-8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credentials),
    storageBucket: credentials.storage_bucket,
  });
}

export const adminStorage = admin.storage().bucket();
export default admin;

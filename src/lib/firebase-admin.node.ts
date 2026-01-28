import admin from "firebase-admin";

const base64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (!base64) {
  throw new Error("Missing FIREBASE_ADMIN_CREDENTIALS_BASE64");
}



if (!storageBucket) {
  throw new Error("Missing FIREBASE_STORAGE_BUCKET");
}

const credentials = JSON.parse(
  Buffer.from(base64, "base64").toString("utf-8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credentials),
    storageBucket,
  });
}

export const adminStorage = admin.storage().bucket(storageBucket);
console.log("🔥 Firebase bucket:", adminStorage.name);
export default admin;

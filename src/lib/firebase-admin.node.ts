import admin from "firebase-admin";

const base64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET;

// Only initialize if we have credentials (not during build)
if (base64 && storageBucket && !admin.apps.length) {
  try {
    const credentials = JSON.parse(
      Buffer.from(base64, "base64").toString("utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(credentials),
      storageBucket: storageBucket,
    });
    
    console.log("✅ Firebase Admin initialized");
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin:", error);
  }
}

// Export functions that check if Firebase is initialized
export const adminStorage = () => {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized");
  }
  return admin.storage().bucket();
};

export default admin;
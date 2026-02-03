export const runtime = "nodejs";

/**
 * Upload PDF to R2 via Cloudflare Worker
 * Completely bypasses SSL issues
 */

const WORKER_URL = process.env.PDF_UPLOAD_WORKER_URL!;
const API_SECRET = process.env.PDF_UPLOAD_API_SECRET!;

export async function uploadPdfToFirebase(
  buffer: Buffer,
  storyId: string
): Promise<string> {
  if (!API_SECRET || !WORKER_URL) {
    throw new Error("PDF upload worker not configured");
  }

  try {
    console.log(
      `📤 Uploading PDF via Worker: ${storyId} (${buffer.length} bytes)`
    );

    const response = await fetch(`${WORKER_URL}?storyId=${storyId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-API-Secret": API_SECRET,
      },
      // ✅ Fetch-safe binary body
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(error.message || `Worker returned ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ PDF uploaded successfully via Worker:", result);

    return result.url;
  } catch (error: any) {
    console.error("❌ Worker upload failed:", error);
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }
}

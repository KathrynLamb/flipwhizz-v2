export async function uploadPdfToR2(
    buffer: Buffer,
    storyId: string
  ): Promise<string> {
    const workerUrl = process.env.PDF_UPLOAD_WORKER_URL;
    const apiSecret = process.env.PDF_UPLOAD_API_SECRET;
  
    if (!workerUrl || !apiSecret) {
      throw new Error("Missing PDF_UPLOAD_WORKER_URL or PDF_UPLOAD_API_SECRET");
    }
  
    console.log(`📤 Uploading PDF to R2: ${storyId} (${buffer.length} bytes)`);
  
    const response = await fetch(
      `${workerUrl}?storyId=${encodeURIComponent(storyId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-API-Secret": apiSecret,
        },
        body: buffer,
      }
    );
  
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`R2 upload failed: ${response.status} ${errorText}`);
    }
  
    const result = await response.json() as { success: boolean; url: string };
  
    console.log("✅ PDF uploaded to R2:", result.url);
    return result.url;
  }
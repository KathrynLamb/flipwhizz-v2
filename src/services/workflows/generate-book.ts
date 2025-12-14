// src/services/workflows/generate-book.ts
import { db } from "@/db";
import { ArtDirector } from "@/services/art-director";
import { ImageLab } from "@/services/image-lab";
import { BookBinder } from "@/services/book-binder";
import { Logistics } from "@/services/gelato";
import { uploadToS3 } from "@/lib/s3";
// import { uploadToS3 } from "@/lib/s3";

export async function processPaidBook(
  storyId: string,
  shippingDetails: any,
  userEmail: string
) {
  console.log(`🚀 Starting Full Production for Story: ${storyId}`);

  // 1. Fetch Data
  const story = await db.query.stories.findFirst({
    where: (stories, { eq }) => eq(stories.id, storyId),
    with: { pages: true },
  });

  // ✅ guard for TS + runtime
  if (!story) {
    throw new Error(`Story not found: ${storyId}`);
  }
  if (!Array.isArray((story as any).pages) || story.pages.length === 0) {
    throw new Error(`Story has no pages: ${storyId}`);
  }

  // Mock Context (In real app, fetch from DB)
  const context = {
    stylePrompt: "Disney pixar style, warm lighting, 8k",
    characterDescription: "Cute boy Leo, 5 years old, blue hoodie",
    locationDescription: "Magical Forest",
  };

  const processedPages: Array<{ text: string; imageUrl: string }> = [];

  // 2. Iterate Pages
  for (const page of story.pages) {
    const pageText = String((page as any).text ?? "").trim();
    if (!pageText) continue;

    // A. Create Prompt
    const prompt = ArtDirector.composePrompt({
      ...context,
      pageAction: pageText,
    });

    // B. Generate Base Image (Or use existing if preview generated)
    let baseImageUrl: string | null =
      (page as any).imageUrl ?? (page as any).imageId ?? null;

    if (!baseImageUrl) {
      baseImageUrl = await ImageLab.generateWebImage(prompt);
      // TODO: persist to DB if needed
    }

    // ✅ make sure we ended up with a URL
    if (!baseImageUrl) {
      throw new Error(`Failed to generate base image for a page in story ${storyId}`);
    }

    // C. Upscale for Print
    const highResUrl = await ImageLab.upscaleForPrint(baseImageUrl);

    processedPages.push({
      text: pageText,
      imageUrl: highResUrl,
    });
  }

  if (processedPages.length === 0) {
    throw new Error(`No printable pages produced for story: ${storyId}`);
  }

  // 3. Bind Book (Create PDF)
  console.log("📚 Compiling PDF...");
  const pdfBuffer = await BookBinder.generatePdf(processedPages);

  // 4. Upload PDF
  const pdfUrl = await uploadToS3(`orders/${storyId}/interior.pdf`, pdfBuffer);

  // 5. Ship it
  console.log("🚚 Sending to Gelato...");
  const order = await Logistics.createOrder(userEmail, shippingDetails, pdfUrl);

  console.log("✅ Order Placed:", order.id);
  return order;
}

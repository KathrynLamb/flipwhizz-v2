import { inngest } from "./client";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { stories, storyStyleGuide, storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

/* -------------------------------------------------
   CONFIG
-------------------------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

/* -------------------------------------------------
   GELATO SPECS FOR 20x20cm HARDCOVER BOOK
-------------------------------------------------- */
const GELATO_SPECS = {
  coverSize: "20x20cm (7.87x7.87 inches)",
  // For square format, covers should be square
  aspectRatio: "1:1 (square)",
  dpi: "300 DPI minimum",
  safeZone: "Keep important elements 3mm (0.12 inches) from edges",
  bleed: "3mm bleed on all sides",
};

/* -------------------------------------------------
   HELPERS
-------------------------------------------------- */

async function fetchImageAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch style image");

  const ab = await res.arrayBuffer();
  return {
    data: Buffer.from(ab).toString("base64"),
    mimeType: res.headers.get("content-type") || "image/jpeg",
  };
}

async function uploadToCloudinary(
  base64: string,
  mimeType: string,
  storyId: string,
  type: "front" | "back"
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/covers/${storyId}`,
        filename_override: `${type}-cover-${uuid()}`,
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res!.secure_url);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);

  return imagePart?.inlineData
    ? {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
      }
    : null;
}

/* -------------------------------------------------
   MAIN ORCHESTRATOR - GENERATES BOTH COVERS
-------------------------------------------------- */

export const generateBookCovers = inngest.createFunction(
  {
    id: "generate-book-covers",
    concurrency: 2,
    retries: 2,
  },
  { event: "story/generate.covers" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    // Mark as generating
    await step.run("mark-generating", async () => {
      await db
        .update(stories)
        .set({
          status: "generating_covers",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    });

    // Fetch story data including interior pages for style reference
    const { story, styleGuide, samplePages } = await step.run(
      "fetch-story-data",
      async () => {
        const s = await db.query.stories.findFirst({
          where: eq(stories.id, storyId),
        });

        if (!s) throw new Error(`Story not found: ${storyId}`);
        if (!s.frontCoverPrompt || !s.backCoverPrompt) {
          throw new Error("Cover prompts not found - generate prompts first");
        }

        const sg = await db.query.storyStyleGuide.findFirst({
          where: eq(storyStyleGuide.storyId, storyId),
        });

        // Get first 2 pages with images as style reference
        const pages = await db.query.storyPages.findMany({
          where: eq(storyPages.storyId, storyId),
          orderBy: asc(storyPages.pageNumber),
          limit: 2,
        });

        return { story: s, styleGuide: sg, samplePages: pages };
      }
    );

    // Dispatch events for front and back cover generation
    const events = [
      {
        name: "story/generate.single.cover",
        data: {
          storyId,
          coverType: "front",
          prompt: story.frontCoverPrompt,
          title: story.title,
          author: "Created with FlipWhizz", // You can make this dynamic
          styleImage: styleGuide?.sampleIllustrationUrl,
          styleSummary: styleGuide?.summary,
          // Pass interior page images for consistency
          interiorPageImages: samplePages
            .filter((p) => p.imageUrl)
            .map((p) => p.imageUrl)
            .slice(0, 2),
        },
      },
      {
        name: "story/generate.single.cover",
        data: {
          storyId,
          coverType: "back",
          prompt: story.backCoverPrompt,
          title: story.title,
          author: "Created with FlipWhizz",
          styleImage: styleGuide?.sampleIllustrationUrl,
          styleSummary: styleGuide?.summary,
          interiorPageImages: samplePages
            .filter((p) => p.imageUrl)
            .map((p) => p.imageUrl)
            .slice(0, 2),
        },
      },
    ];

    await step.sendEvent("dispatch-cover-workers", events);

    return { coversQueued: 2 };
  }
);

/* -------------------------------------------------
   WORKER - GENERATES A SINGLE COVER
-------------------------------------------------- */

export const generateSingleCover = inngest.createFunction(
  {
    id: "generate-single-cover",
    concurrency: 4,
    retries: 2,
  },
  { event: "story/generate.single.cover" },
  async ({ event, step }) => {
    const {
      storyId,
      coverType,
      prompt,
      title,
      author,
      styleImage,
      styleSummary,
      interiorPageImages,
    } = event.data;

    const coverUrl = await step.run("generate-cover-image", async () => {
      const parts: any[] = [];
      const isBack = coverType === "back";

      // Add style reference from interior pages
      if (styleImage) {
        const img = await fetchImageAsBase64(styleImage);
        parts.push({
          text: "STYLE GUIDE REFERENCE (Match this illustration style EXACTLY):",
        });
        parts.push({ inlineData: img });
      }

      // Add interior page references for character/location consistency
      if (interiorPageImages && interiorPageImages.length > 0) {
        parts.push({
          text: "INTERIOR PAGE EXAMPLES (Use these as reference for character appearance, art style, and visual consistency):",
        });

        for (const pageUrl of interiorPageImages) {
          try {
            const pageImg = await fetchImageAsBase64(pageUrl);
            parts.push({ inlineData: pageImg });
          } catch (e) {
            console.warn("Failed to fetch interior page:", e);
          }
        }
      }

      const fullPrompt = `You are a master children's book cover illustrator creating a professional, publishable book cover.

BOOK FORMAT & TECHNICAL SPECS:
- Format: 20x20cm (7.87" x 7.87") SQUARE hardcover book
- Output: SQUARE aspect ratio (1:1)
- Quality: Print-ready, 300 DPI minimum
- Safe zone: Keep all important elements 3mm from edges
- Bleed: 3mm on all sides

CRITICAL STYLE CONSISTENCY:
You have been provided with the style guide and interior page examples above.
- Characters MUST look IDENTICAL to how they appear in the interior pages
- Art style, line work, and coloring MUST match the interior exactly
- Locations and props should be visually consistent
- This should look like it was illustrated by the same artist on the same day

STYLE DEFINITION: ${styleSummary || "Warm, inviting children's book illustration"}

${prompt}

${
  isBack
    ? `
═══════════════════════════════════════════════════════════
BACK COVER DESIGN (20x20cm SQUARE)
═══════════════════════════════════════════════════════════

VISUAL CONTENT:
- Create a complementary illustration that matches the front cover style
- Show a different scene or decorative pattern from the story
- Maintain character consistency with interior pages

TEXT INTEGRATION (Render these as beautiful, integrated typography):
- Include a SHORT back cover blurb (2-3 sentences max) that teases the story
- The blurb should be professionally typeset and integrated into the design
- Author credit at bottom: "Created with FlipWhizz"
- Use children's book typography that matches the story's tone

LAYOUT REQUIREMENTS:
- Top 50%: Main illustration/decorative elements
- Middle 30%: Space for blurb text (integrated beautifully)
- Bottom right corner: 2" x 1.5" clear zone for ISBN barcode
- Bottom 20%: Author credit and publisher info

TYPOGRAPHY STYLE:
- Use warm, friendly fonts appropriate for children's books
- Ensure text is highly readable with good contrast
- Integrate text naturally into the illustration (not just placed on top)
- Make it look like a professionally published children's book
`
    : `
═══════════════════════════════════════════════════════════
FRONT COVER DESIGN (20x20cm SQUARE)
═══════════════════════════════════════════════════════════

BOOK TITLE: "${title}"
AUTHOR: "${author}"

VISUAL CONTENT:
- Feature the main character(s) exactly as they appear in the interior pages
- Show the key moment or scene from the cover brief
- Create maximum shelf appeal - this should grab attention
- Keep important visual elements within the safe zone (3mm from edges)

TEXT INTEGRATION (Critical - render as beautiful integrated typography):
- Title: "${title}" - should be PROMINENT, beautifully designed, and integrated
- Author: "${author}" - smaller, elegant placement
- Use professional children's book typography
- Text should feel like part of the illustration, not an afterthought
- Consider creative text treatments (curved, shaped, textured) that fit the story

TITLE PLACEMENT OPTIONS:
- Top 25% with decorative frame or banner
- Bottom 25% if character is focal point in upper portion
- Integrated into scene (on signs, clouds, magical text, etc.)
- Whatever placement best serves the composition

COMPOSITION:
- Main character should be engaging and welcoming
- Create depth with foreground, midground, background
- Leave appropriate negative space for title
- Ensure face/important elements are within safe zone
- Square format - use the full space creatively

TYPOGRAPHY GUIDELINES:
- Font should match the story's tone (playful, adventurous, cozy, etc.)
- High contrast for readability
- Large enough to read at thumbnail size (shelf appeal)
- Consider shadow, outline, or glow effects for legibility
- Make it look professionally published, not amateur
`
}

CRITICAL REMINDERS:
1. Characters MUST match their appearance in interior pages
2. Art style MUST be consistent with the style guide and interior pages
3. This is a SQUARE (1:1) format - not rectangular
4. All text should be rendered professionally and integrated into the design
5. This should look indistinguishable from a major publisher's children's book
6. Print-ready quality with proper safe zones and bleed

Generate the complete, professional cover illustration with integrated typography now.
`;

      parts.push({ text: fullPrompt });

      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE"] },
      });

      const output = extractInlineImage(response);
      if (!output) {
        throw new Error(`Gemini did not return ${coverType} cover image.`);
      }

      return await uploadToCloudinary(
        output.data,
        output.mimeType,
        storyId,
        coverType as "front" | "back"
      );
    });

    // Save URL to DB
    await step.run("save-cover-url", async () => {
      const updateField =
        coverType === "front" ? "frontCoverUrl" : "backCoverUrl";

      await db
        .update(stories)
        .set({
          [updateField]: coverUrl,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    });

    // Check if BOTH covers are done → mark complete
    await step.run("check-and-mark-complete", async () => {
      const s = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      });

      if (s?.frontCoverUrl && s?.backCoverUrl) {
        await db
          .update(stories)
          .set({
            status: "covers_ready",
            updatedAt: new Date(),
          })
          .where(eq(stories.id, storyId));
      }
    });

    return { success: true, coverType, coverUrl };
  }
);

export const generateWrapAroundCover = inngest.createFunction(
  {
    id: "generate-wraparound-cover",
    concurrency: 2,
    retries: 2,
  },
  { event: "story/generate.wraparound.cover" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    const { story, styleGuide } = await step.run("fetch-story-data", async () => {
      const s = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      });

      if (!s) throw new Error(`Story not found: ${storyId}`);
      if (!s.frontCoverPrompt || !s.backCoverPrompt) {
        throw new Error("Cover prompts not found");
      }

      const sg = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      return { story: s, styleGuide: sg };
    });

    const coverUrl = await step.run("generate-wraparound-image", async () => {
      const parts: any[] = [];

      if (styleGuide?.sampleIllustrationUrl) {
        const img = await fetchImageAsBase64(styleGuide.sampleIllustrationUrl);
        parts.push({ text: "STYLE REFERENCE:" });
        parts.push({ inlineData: img });
      }

      const prompt = `
You are a professional children's book cover designer.

TASK:
Create a SINGLE full hardcover book wrap-around cover image.

LAYOUT (WIDE FORMAT - APPROXIMATELY 2:1 ASPECT RATIO):
- LEFT third: BACK COVER
- CENTER strip: SPINE (thin, no text)
- RIGHT two-thirds: FRONT COVER (main focus)

STYLE: ${styleGuide?.summary || "Children's book illustration"}

FRONT COVER (RIGHT SIDE):
${story.frontCoverPrompt}

BACK COVER (LEFT SIDE):
${story.backCoverPrompt}

TITLE: "${story.title}"
- Render the title ONLY on the front cover (right side)
- Make it prominent, readable, and integrated with the design
- Use appropriate children's book typography

IMPORTANT:
- Do NOT place text on the spine
- The back cover should complement the front but be distinct
- Ensure visual flow across the entire wrap
- No logos, watermarks, or signatures
- Professional, print-ready quality

Generate the complete wrap-around cover now.
`;

      parts.push({ text: prompt });

      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE"] },
      });

      const output = extractInlineImage(response);
      if (!output) throw new Error("Gemini did not return wraparound cover");

      return await uploadToCloudinary(
        output.data,
        output.mimeType,
        storyId,
        "front"
      );
    });

    await step.run("save-wraparound-url", async () => {
      await db
        .update(stories)
        .set({
          coverImageUrl: coverUrl,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    });

    return { success: true, coverUrl };
  }
);
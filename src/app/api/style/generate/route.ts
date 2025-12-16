// import { NextResponse } from "next/server";
// import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
// import { eq } from "drizzle-orm";
// import { storyStyleGuide } from "@/db/schema";
// import { db } from "@/db";

// import { v2 as cloudinary } from "cloudinary";
// import { Readable } from "node:stream";
// import { v4 as uuid } from "uuid";

// export const maxDuration = 60;

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//   api_key: process.env.CLOUDINARY_API_KEY!,
//   api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

// async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
//   const buffer = Buffer.from(base64Data, "base64");
//   const result: any = await new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       {
//         folder: `flipwhizz/style-samples/${storyId}`,
//         filename_override: uuid(),
//         resource_type: "image",
//       },
//       (err, res) => {
//         if (err) reject(err);
//         else resolve(res);
//       }
//     );
//     Readable.from(buffer).pipe(stream);
//   });
//   return result.secure_url as string;
// }

// // 1. Init Client
// const client = new GoogleGenAI({ 
//   apiKey: process.env.GEMINI_API_KEY,
//   apiVersion: "v1alpha" // Ensure alpha for preview models
// });

// // --- Helper: Fetch Image ---
// async function fetchImageAsBase64(url: string) {
//   try {
//     const res = await fetch(url);
//     if (!res.ok) return null;
//     const arrayBuffer = await res.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);
//     return {
//       data: buffer.toString("base64"),
//       mimeType: "image/jpeg", // Force JPEG for consistency with Gemini
//     };
//   } catch (e) {
//     console.error("Fetch failed for", url);
//     return null;
//   }
// }

// // --- Helper: Extract Image ---
// function extractInlineImage(result: any) {
//   const parts = result.candidates?.[0]?.content?.parts || [];
  
//   // Log thoughts for debugging
//   const thinkingPart = parts.find((p: any) => p.text);
//   if (thinkingPart) console.log("🤖 Gemini Thought:", thinkingPart.text.substring(0, 150) + "...");

//   const imagePart = parts.find((p: any) => p.inlineData?.data);
//   return imagePart?.inlineData
//     ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
//     : null;
// }

// export async function POST(req: Request) {
//   try {
//     const body = await req.json();
//     let { 
//       references = [], 
//       leftText = "", 
//       rightText = "",
//       description = "",
//       storyId, 
//     } = body;

//     if (!storyId) return NextResponse.json({ error: "storyId is required" }, { status: 400 });

//     // --- 1. SYSTEM INSTRUCTION (Context) ---
//     // We define the role here so it doesn't get mixed with the user prompt
//     const systemInstruction = {
//       parts: [{ text: `You are an expert children's book illustrator. 
//       Your task is to generate a double-page spread illustration for a book.
//       The output must be a single image containing the illustration and the text.
      
//       CRITICAL: You will be provided with REFERENCE IMAGES.
//       1. STYLE REFERENCE: You MUST adopt the art style of this image exactly (brush strokes, color palette, mood).
//       2. CHARACTER REFERENCE: You MUST draw the characters to look like the provided reference (hair, clothes, features) but adapted to the requested Art Style.` }]
//     };

//     // --- 2. BUILD USER CONTENT ---
//     const parts: any[] = [];

//     // A. Push Images FIRST (Context)
//     const pushImages = async (refs: any[], label: string) => {
//       for (const ref of refs) {
//         if (!ref.url) continue;
//         const img = await fetchImageAsBase64(ref.url);
//         if (img) {
//           parts.push({ text: `\n[${label} REFERENCE IMAGE]: ${ref.notes || ""}` });
//           parts.push({ inlineData: img });
//         }
//       }
//     };

//     // Push style first, then characters
//     await pushImages(references.filter((r: any) => r.type === 'style'), "ART STYLE");
//     await pushImages(references.filter((r: any) => r.type === 'character'), "CHARACTER");
//     await pushImages(references.filter((r: any) => r.type === 'location'), "LOCATION");

//     // B. Push The Actual Request
//     let textPrompt = `
//     GENERATE THE ILLUSTRATION NOW:
    
//     SCENE DESCRIPTION:
//     ${description}

//     TEXT TO RENDER (Legible):
//     - Left Page: "${leftText}"
//     - Right Page: "${rightText}"
//     `;
    
//     parts.push({ text: textPrompt });

//     console.log(`Generating with Gemini 3 Pro Image Preview (${parts.length} parts)...`);
//     console.log("parts", parts)
//     // --- 3. CALL API ---
//     const response = await client.models.generateContent({
//       model: "gemini-3-pro-image-preview", 
//       contents: [{ role: "user", parts }],
//       systemInstruction: systemInstruction, // Use proper system instruction field
//       config: {
//         responseModalities: ["TEXT", "IMAGE"], 
//         // ❌ REMOVED googleSearch: {} -- This conflicts with image-based generation
//         safetySettings: [
//           { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
//           { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
//           { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
//           { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
//         ],
//       },
//     });

//     const output = extractInlineImage(response);
    
//     if (!output) {
//       console.error("Gemini 3 Failure Log:", JSON.stringify(response, null, 2));
//       throw new Error("Gemini 3 blocked the image. Likely a conflict between the prompt and safety filters. Try simplifying the prompt.");
//     }

//     // --- 4. SAVE ---
//     const imageUrl = await saveImageToStorage(output.data, output.mimeType, storyId);

//     // Update DB
//     const existing = await db.query.storyStyleGuide.findFirst({
//       where: eq(storyStyleGuide.storyId, storyId),
//     });

//     if (existing) {
//       await db.update(storyStyleGuide)
//         .set({ sampleIllustrationUrl: imageUrl, updatedAt: new Date() })
//         .where(eq(storyStyleGuide.id, existing.id));
//     } else {
//       await db.insert(storyStyleGuide).values({
//         storyId,
//         sampleIllustrationUrl: imageUrl,
//       });
//     }

//     return NextResponse.json({ 
//       success: true, 
//       image: output,
//       savedUrl: imageUrl, 
//     });

//   } catch (err: any) {
//     console.error("Generator Error:", err);
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }

import { NextResponse } from "next/server";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq } from "drizzle-orm";
import { storyStyleGuide } from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Initialize Client (v1alpha needed for Gemini 3)
const client = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha"
});

// --- Helper: Save to Cloudinary ---
async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
  const buffer = Buffer.from(base64Data, "base64");
  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/style-samples/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
  return result.secure_url as string;
}

// --- Helper: Fetch Image & Convert to Base64 ---
async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch (e) {
    console.error("Fetch failed for", url);
    return null;
  }
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  
  // Safe extraction of thinking/text parts
  const thinkingText = parts.find((p: any) => p.text)?.text;
  if (thinkingText) {
    console.log("🤖 Gemini 3 Thought:", thinkingText.substring(0, 100) + "...");
  }
  
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : null;
}

// --- STEP 1: Analyze Character Image (Using Gemini 3) ---
async function analyzeCharacterImage(imageUrl: string, charName: string) {
    try {
        console.log(`🔍 Analyzing ${charName} with Gemini 3 Vision...`);
        const imgData = await fetchImageAsBase64(imageUrl);
        if (!imgData) return "";

        // ✅ Updated to use Gemini 3
        const result = await client.models.generateContent({
            model: "gemini-3-pro-image-preview", 
            contents: [{
                role: "user",
                parts: [
                    { text: `Describe the visual appearance of the person in this photo so an illustrator can create a character based on them. 
                    Focus on: Hairstyle, hair color, eye color, facial structure, clothing, and approximate age.
                    Keep it descriptive but concise (2 sentences).
                    IMPORTANT: Do NOT say "real photo" or "photograph". Just describe the physical traits.` },
                    { inlineData: imgData }
                ]
            }],
            config: {
                responseModalities: ["TEXT"], // We only want text output for this step
                // Safety settings are crucial here so it doesn't block the input photo
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
            }
        });
        
        // Gemini 3 text extraction
        const parts = result.candidates?.[0]?.content?.parts || [];
        // We use optional chaining and nullish coalescing to ensure 'text' is always a string
        const text: string = parts.find((p: any) => p.text)?.text ?? "";
        
        console.log(`📝 Description for ${charName}: "${text.trim()}"`);
        return text.trim();
        
    
    } catch (e) {
        console.warn(`Failed to analyze character image:`, e);
        return ""; 
    }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { 
      references = [], 
      leftText = "", 
      rightText = "",
      description = "",
      storyId, 
    } = body;

    if (!storyId) return NextResponse.json({ error: "storyId is required" }, { status: 400 });

    // =================================================================================
    // STEP 1: PREPARE CHARACTER DESCRIPTIONS (Image-to-Text via Gemini 3)
    // =================================================================================
    
    let characterDescriptions = "";

    const charRefs = references.filter((r: any) => r.type === 'character');
    
    for (const char of charRefs) {
        let visualDesc = char.notes || ""; 
        
        // If there is a photo, ask Gemini 3 to describe it
        if (char.url) {
            const autoDesc = await analyzeCharacterImage(char.url, char.label);
            if (autoDesc) {
                visualDesc = `${autoDesc}. ${visualDesc}`;
            }
        }
        characterDescriptions += `- ${char.label}: ${visualDesc}\n`;
    }

    // =================================================================================
    // STEP 2: GENERATE IMAGE WITH GEMINI 3 (Text-to-Image + Style Ref)
    // =================================================================================

    // Construct the prompt for Gemini 3
    let textPrompt = `You are a professional children's book illustrator.
    
    TASK: Generate a single high-quality illustration of an open book (double-page spread) lying flat.
    
    STYLE INSTRUCTIONS:
    - You MUST use the attached "ART STYLE" image as the primary visual reference.
    - Adapt all characters and scenery to match this specific art style (brushwork, color palette, mood).
    - Do NOT generate photorealistic people. This must be an ARTISTIC ILLUSTRATION.
    
    SCENE DESCRIPTION:
    ${description}
    
    CHARACTERS TO DRAW (Based on these descriptions):
    ${characterDescriptions}
    
    TEXT LAYOUT (Render this text clearly on the pages):
    - Left Page: "${leftText}"
    - Right Page: "${rightText}"
    `;

    // Build the payload
    const parts: any[] = [{ text: textPrompt }];

    // ONLY add the Style Reference image (Base64). 
    // We DO NOT add character images here (to avoid safety blocks).
    const styleRefs = references.filter((r: any) => r.type === 'style');
    for (const ref of styleRefs) {
        if (!ref.url) continue;
        const img = await fetchImageAsBase64(ref.url);
        if (img) {
            parts.push({ text: `\n[ART STYLE REFERENCE IMAGE]:` });
            parts.push({ inlineData: img });
        }
    }

    console.log(`Generating with Gemini 3 Pro Image Preview...`);

    const response = await client.models.generateContent({
      model: "gemini-3-pro-image-preview", 
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"], 
        // No tools/search enabled to avoid conflict
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
    });

    const output = extractInlineImage(response);
    
    if (!output) {
      console.error("Gemini 3 Failure Log:", JSON.stringify(response, null, 2));
      throw new Error("Gemini 3 refused to generate the image (Safety Block or No Output).");
    }

    // --- Save & DB ---
    const imageUrl = await saveImageToStorage(output.data, output.mimeType, storyId);

    const existing = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (existing) {
      await db.update(storyStyleGuide)
        .set({ sampleIllustrationUrl: imageUrl, updatedAt: new Date() })
        .where(eq(storyStyleGuide.id, existing.id));
    } else {
      await db.insert(storyStyleGuide).values({
        storyId,
        sampleIllustrationUrl: imageUrl,
      });
    }

    return NextResponse.json({ 
      success: true, 
      image: output,
      savedUrl: imageUrl, 
    });

  } catch (err: any) {
    console.error("Generator Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
// src/app/api/style-guide/process-feedback/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { storyId, feedback, referenceImageUrl } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // Get current style guide
    const [guide] = await db
      .select()
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId));

    if (!guide) {
      return NextResponse.json({ error: "Style guide not found" }, { status: 404 });
    }

    const currentStyle = guide.summary || "";

    // Build prompt for Claude to update style description
    let analysisPrompt = `You are helping refine a children's book illustration style guide.

Current style description:
${currentStyle}

User feedback on the generated sample:
${feedback}

`;

    const messages: any[] = [
      {
        role: "user",
        content: [],
      },
    ];

    // Add reference image if provided
    if (referenceImageUrl) {
      analysisPrompt += `The user also provided a reference image showing the style they want.

Please analyze both the feedback and the reference image to create an updated, detailed style description that incorporates the requested changes.`;

      // Fetch image and convert to base64
      const imageRes = await fetch(referenceImageUrl);
      const imageBuffer = await imageRes.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      
      const mediaType = referenceImageUrl.toLowerCase().endsWith(".png") 
        ? "image/png" 
        : "image/jpeg";

      messages[0].content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Image,
        },
      });
    } else {
      analysisPrompt += `Based on this feedback, create an updated, detailed style description that addresses the user's concerns while maintaining what was working well.`;
    }

    analysisPrompt += `\n\nProvide ONLY the updated style description, no explanations or preamble. Be specific about colors, textures, line work, lighting, and atmosphere.`;

    messages[0].content.push({
      type: "text",
      text: analysisPrompt,
    });

    // Call Claude to analyze and update style
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages,
    });

    const updatedStyleDescription = response.content[0].type === "text" 
      ? response.content[0].text.trim() 
      : currentStyle;

    // Save updated style description and feedback directly to database
    await db
      .update(storyStyleGuide)
      .set({
        summary: updatedStyleDescription,
        feedback: feedback, // Save the feedback
        approved: false, // Mark as not approved since changes were requested
        updatedAt: new Date(),
      })
      .where(eq(storyStyleGuide.storyId, storyId));

    console.log("✅ Style guide updated with feedback");

    return NextResponse.json({
      success: true,
      updatedStyleDescription,
    });

  } catch (err: any) {
    console.error("[process-feedback]", err);
    return NextResponse.json(
      { error: err.message || "Failed to process feedback" },
      { status: 500 }
    );
  }
}
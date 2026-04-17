// src/app/api/characters/validate-reference/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, characterName } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
    }

    // Fetch the image and convert to base64 for Claude
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return NextResponse.json({ error: "Could not fetch image" }, { status: 400 });
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = (imageRes.headers.get("content-type") || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: contentType,
                data: base64,
              },
            },
            {
              type: "text",
              text: `You are validating a reference photo uploaded for a children's book character${characterName ? ` named "${characterName}"` : ""}.

Analyse this image and respond ONLY with a JSON object — no preamble, no markdown.

Rules:
- "valid" must be true only if the image shows exactly ONE person or animal clearly as the main subject
- "issue" must be one of: "group_photo", "no_subject", "unclear", "screenshot", "illustration", or null
- "message" must be a short, friendly message explaining the problem (max 12 words), or null if valid

Examples of INVALID images: group photos, crowd shots, landscapes with no clear subject, screenshots of apps or text, cartoon/illustration images.
Examples of VALID images: a single person portrait, a solo photo of a dog or cat, a child on their own even with blurred background figures.

Respond with exactly this shape:
{"valid": boolean, "issue": string | null, "message": string | null}`,
            },
          ],
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();

    let result: { valid: boolean; issue: string | null; message: string | null };
    try {
      result = JSON.parse(clean);
    } catch {
      // Claude failed to return valid JSON — fail open so upload isn't blocked
      console.error("validate-reference: JSON parse failed, failing open", raw);
      return NextResponse.json({ valid: true, issue: null, message: null });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("validate-reference error:", err);
    // Fail open — don't block uploads if the validation service is down
    return NextResponse.json({ valid: true, issue: null, message: null });
  }
}
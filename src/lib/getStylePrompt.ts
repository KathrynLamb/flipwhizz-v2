// src/lib/getStylePrompt.ts
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getUnifiedStylePrompt(storyId: string) {
  const guide = await db
    .select()
    .from(storyStyleGuide)
    .where(eq(storyStyleGuide.storyId, storyId))
    .then((r) => r[0] ?? null);

  const summary = guide?.summary ?? "Not specified";
  const palette = (guide as any)?.palette ?? "natural";
  const lighting = (guide as any)?.lighting ?? "soft ambient";
  const render = (guide as any)?.render ?? "storybook illustration";
  const referenceImageUrl = (guide as any)?.referenceImageUrl ?? "None";
  const negativePrompt = guide?.negativePrompt ?? "";

  return `
ILLUSTRATION STYLE GUIDE (STRICT):
- Summary: ${summary}
- Palette: ${palette}
- Lighting: ${lighting}
- Render technique: ${render}
- Reference Image: ${referenceImageUrl}
- Avoid: ${negativePrompt || "Not specified"}

You MUST maintain consistent character proportions, line quality, palette, lighting, rendering, and mood across ALL images. Do not deviate.
`.trim();
}

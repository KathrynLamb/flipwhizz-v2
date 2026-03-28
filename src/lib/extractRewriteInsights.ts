// src/lib/extractRewriteInsights.ts
//
// Extracts reader insights from rewrite chat conversations.
// Called fire-and-forget after a successful global rewrite.
// Only extracts developmental observations — ignores pure edit requests.

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { readerInsights } from "@/db/schema";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface ExtractedInsight {
  type: string;
  content: string;
  confidence: number;
}

export async function extractInsightsFromRewriteChat(
  readerId: string,
  storyId: string,
  conversation: string
): Promise<void> {
  if (!conversation || conversation.trim().length < 50) return;

  console.log("💡 [insights] Extracting from rewrite conversation...");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You analyze editing conversations between a parent and a children's book co-author. Your job is to extract DEVELOPMENTAL INSIGHTS about the child — information that would help make future stories better for this specific child.

EXTRACT insights when the parent reveals:
- Educational context: "she's learning phonics", "he's in Year 1", "working on counting to 20"
- Developmental milestones: "she can read three-letter words now", "he just learned to ride a bike"
- Emotional/social context: "she's been arguing with her brother", "he's nervous about swimming lessons"
- Preferences that persist: "she hates scary parts", "he always wants the dog to be the hero"
- Life events: "we just moved house", "new baby sister arriving soon"
- Sensitivities: "we keep pronouns neutral", "please avoid mentions of hospitals"

DO NOT extract:
- Pure story edit requests: "make page 5 funnier", "change the dog's name to Bodi"
- One-time creative decisions: "set it in a forest instead", "add a dragon"
- Style preferences for this specific book: "make it rhyme", "shorter sentences"

If there are NO developmental insights in the conversation, return an empty array.

Return ONLY valid JSON:
{
  "insights": [
    { "type": "reading_progress", "content": "Learning phonics, CVC words stage, Grade 1", "confidence": 90 },
    { "type": "preference", "content": "Parent prefers gender-neutral pronouns in stories", "confidence": 95 }
  ]
}

Types: "interest", "fear", "life_event", "milestone", "personality", "reading_progress", "emotional_need", "social", "preference", "sensitivity"`,
      messages: [
        {
          role: "user",
          content: `Here is the editing conversation:\n\n${conversation}`,
        },
      ],
    });

    let raw = (response.content[0] as any).text?.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(raw);
    const insights: ExtractedInsight[] = Array.isArray(parsed.insights)
      ? parsed.insights.filter((i: any) => i?.type && i?.content)
      : [];

    if (insights.length === 0) {
      console.log("💡 [insights] No developmental insights found in rewrite conversation");
      return;
    }

    for (const insight of insights) {
      try {
        await db.insert(readerInsights).values({
          readerId,
          insightType: insight.type,
          content: insight.content,
          confidence: Math.min(100, Math.max(0, insight.confidence || 80)),
          isActive: true,
          sourceType: "chat",
          sourceStoryId: storyId,
        });
      } catch (err) {
        console.warn(`⚠️ Failed to save insight: ${insight.content}`, err);
      }
    }

    console.log(`💡 [insights] Saved ${insights.length} insights from rewrite conversation`);
  } catch (err) {
    console.warn("⚠️ Insight extraction failed:", err);
  }
}
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

const StrategistMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["assistant", "user"]),
  content: z.string().min(1),
  createdAt: z.string().optional(),
});

const ContextCharacterSchema = z.object({
  characterId: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  outfitKey: z.string().nullable().optional(),
});

const ContextLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable().optional(),
});

const RedrawStrategistContextSchema = z.object({
  storyTitle: z.string(),
  spreadLabel: z.string(),
  sceneSummary: z.string().nullable().optional(),
  leftPageText: z.string().nullable().optional(),
  rightPageText: z.string().nullable().optional(),
  currentSpreadImageUrl: z.string().nullable().optional(),
  styleGuideSummary: z.string().nullable().optional(),
  styleGuideLabel: z.string().nullable().optional(),
  characters: z.array(ContextCharacterSchema),
  locations: z.array(ContextLocationSchema).optional().default([]),
});

const RequestSchema = z.object({
  spreadId: z.string().nullable().optional(),
  context: RedrawStrategistContextSchema,
  messages: z.array(StrategistMessageSchema).min(1),
});

const PlanSchema = z.object({
    diagnosis: z.array(z.string()).default([]),
    strategy: z.enum([
      "standard_redraw",
      "identity_repair",
      "cast_simplification",
      "split_into_two_pages",
    ]),
    executionMode: z.enum([
      "single_spread_identity_repair",
      "single_spread_with_reduced_cast",
      "split_into_two_single_pages",
    ]),
    keepUnifiedSpread: z.boolean(),
    splitIntoTwoPages: z.boolean(),
  
    featuredCharacterIds: z.array(z.string()).default([]),
    backgroundCharacterIds: z.array(z.string()).default([]),
    hiddenCharacterIds: z.array(z.string()).default([]),
  
    outfitOverrides: z.record(z.string(), z.string()).optional(),
    recommendedPrompt: z.string(),
    notesToUser: z.string().optional(),
  
    leftPagePrompt: z.string().optional(),
    rightPagePrompt: z.string().optional(),
  
    leftPageFeaturedCharacterIds: z.array(z.string()).optional(),
    rightPageFeaturedCharacterIds: z.array(z.string()).optional(),
  
    leftPageBackgroundCharacterIds: z.array(z.string()).optional(),
    rightPageBackgroundCharacterIds: z.array(z.string()).optional(),
  
    leftPageHiddenCharacterIds: z.array(z.string()).optional(),
    rightPageHiddenCharacterIds: z.array(z.string()).optional(),
  });

type Plan = z.infer<typeof PlanSchema>;
type StrategistMessage = z.infer<typeof StrategistMessageSchema>;
type StrategistContext = z.infer<typeof RedrawStrategistContextSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function xmlEscape(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

function dedupeBy<T>(items: T[], key: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [key(item), item])).values());
}

function clampCharacters(
  ids: string[],
  max: number,
  fallbackIds: string[]
): string[] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length > 0) return unique.slice(0, max);
  return fallbackIds.slice(0, max);
}

function extractTextFromAnthropicResponse(data: any): string {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  return text;
}

function extractTaggedBlock(source: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = source.match(re);
  return match?.[1]?.trim() ?? null;
}

function extractJsonBlock(source: string): string | null {
  const fenced = source.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const generic = source.match(/```[\s\S]*?\n([\s\S]*?)```/i);
  if (generic?.[1]) return generic[1].trim();

  return null;
}

function safeParsePlan(rawText: string, context: StrategistContext): Plan | null {
  console.log("[strategist] 🔍 Attempting to parse plan from response...");
  
  const tagged = extractTaggedBlock(rawText, "redraw_plan_json");
  const fenced = extractJsonBlock(rawText);
  const candidate = tagged ?? fenced;

  console.log("[strategist] 📋 Tagged block found:", !!tagged);
  console.log("[strategist] 📋 Fenced block found:", !!fenced);
  console.log("[strategist] 📋 Candidate length:", candidate?.length ?? 0);

  if (!candidate) {
    console.log("[strategist] ⚠️ No plan JSON found in response");
    return null;
  }

  try {
    const parsed = JSON.parse(candidate);
    console.log("[strategist] ✅ JSON parsed successfully, strategy:", parsed.strategy);
    
    const result = PlanSchema.safeParse(parsed);
    if (!result.success) {
      console.log("[strategist] ❌ Zod validation failed:", JSON.stringify(result.error.flatten()));
      return null;
    }

    console.log("[strategist] ✅ Zod validation passed");

    const characterIds = context.characters.map((c) => c.characterId);

    const featured = clampCharacters(
      result.data.featuredCharacterIds.filter((id) => characterIds.includes(id)),
      5,
      characterIds
    );

    const background = Array.from(
      new Set(
        result.data.backgroundCharacterIds.filter(
          (id) => characterIds.includes(id) && !featured.includes(id)
        )
      )
    );

    const hidden = Array.from(
      new Set(
        result.data.hiddenCharacterIds.filter(
          (id) =>
            characterIds.includes(id) &&
            !featured.includes(id) &&
            !background.includes(id)
        )
      )
    );

    const leftFeatured = Array.from(
      new Set(
        (result.data.leftPageFeaturedCharacterIds ?? []).filter((id) =>
          characterIds.includes(id)
        )
      )
    ).slice(0, 3);

    const rightFeatured = Array.from(
      new Set(
        (result.data.rightPageFeaturedCharacterIds ?? []).filter((id) =>
          characterIds.includes(id)
        )
      )
    ).slice(0, 3);

    const leftBackground = Array.from(
      new Set(
        (result.data.leftPageBackgroundCharacterIds ?? []).filter(
          (id) => characterIds.includes(id) && !leftFeatured.includes(id)
        )
      )
    );

    const rightBackground = Array.from(
      new Set(
        (result.data.rightPageBackgroundCharacterIds ?? []).filter(
          (id) => characterIds.includes(id) && !rightFeatured.includes(id)
        )
      )
    );

    const leftHidden = Array.from(
      new Set(
        (result.data.leftPageHiddenCharacterIds ?? []).filter(
          (id) =>
            characterIds.includes(id) &&
            !leftFeatured.includes(id) &&
            !leftBackground.includes(id)
        )
      )
    );

    const rightHidden = Array.from(
      new Set(
        (result.data.rightPageHiddenCharacterIds ?? []).filter(
          (id) =>
            characterIds.includes(id) &&
            !rightFeatured.includes(id) &&
            !rightBackground.includes(id)
        )
      )
    );

    console.log("[strategist] 📊 Plan character assignment:", {
      featured: featured.length,
      background: background.length,
      hidden: hidden.length,
      strategy: result.data.strategy,
      executionMode: result.data.executionMode,
    });

    return {
      ...result.data,
      featuredCharacterIds: featured,
      backgroundCharacterIds: background,
      hiddenCharacterIds: hidden,

      leftPageFeaturedCharacterIds: leftFeatured,
      rightPageFeaturedCharacterIds: rightFeatured,

      leftPageBackgroundCharacterIds: leftBackground,
      rightPageBackgroundCharacterIds: rightBackground,

      leftPageHiddenCharacterIds: leftHidden,
      rightPageHiddenCharacterIds: rightHidden,
    };
  } catch (err) {
    console.log("[strategist] ❌ JSON parse error:", err);
    return null;
  }
}

function buildFallbackPlan(
    context: StrategistContext,
    latestUserMessage: string,
    assistantMessage: string
  ): Plan {
    console.log("[strategist] ⚠️ Using FALLBACK plan (Claude didn't return valid JSON)");
    console.log("[strategist] 📝 Latest user message:", latestUserMessage.slice(0, 100));
    
    const ids = context.characters.map((c) => c.characterId);
    const featuredIds = ids.slice(0, Math.min(3, ids.length));
    const backgroundIds = ids.filter((id) => !featuredIds.includes(id));
  
    const lower = latestUserMessage.toLowerCase();
    const shouldSplit =
      lower.includes("split") ||
      lower.includes("two pages") ||
      lower.includes("2 pages") ||
      lower.includes("too many") ||
      lower.includes("crowded");
  
    console.log("[strategist] 📊 Fallback decision — shouldSplit:", shouldSplit);

    if (shouldSplit) {
      const leftFeatured = ids.slice(0, Math.min(3, ids.length));
      const rightFeatured = ids.slice(
        Math.min(3, ids.length),
        Math.min(6, ids.length)
      );
  
      return {
        diagnosis: [
          "The scene appears overloaded for one unified spread.",
          "More than three clearly readable identities are competing in the same frame.",
          "Splitting the moment into action and reaction pages should improve likeness and separation.",
        ],
        strategy: "split_into_two_pages",
        executionMode: "split_into_two_single_pages",
        keepUnifiedSpread: false,
        splitIntoTwoPages: true,
  
        featuredCharacterIds: featuredIds,
        backgroundCharacterIds: backgroundIds,
        hiddenCharacterIds: [],
  
        recommendedPrompt: [
          `Reinterpret ${context.spreadLabel} as two linked single-page illustrations instead of one overloaded wide spread.`,
          `Keep the same moment, location, outfits, palette, and emotional continuity.`,
          `Separate the action beat from the reaction beat so featured faces are larger and more accurate.`,
        ].join(" "),
  
        notesToUser: assistantMessage,
  
        leftPagePrompt: [
          `Create a single-page illustration for the action beat of ${context.spreadLabel}.`,
          `Prioritise exact identity matching for the left-page featured characters.`,
          `Keep this page focused, readable, and emotionally clear.`,
        ].join(" "),
  
        rightPagePrompt: [
          `Create a single-page illustration for the reaction beat of ${context.spreadLabel}.`,
          `Prioritise exact identity matching for the right-page featured characters.`,
          `Keep supporting characters secondary and avoid duplicate-looking faces.`,
        ].join(" "),
  
        leftPageFeaturedCharacterIds: leftFeatured,
        rightPageFeaturedCharacterIds: rightFeatured,
  
        leftPageBackgroundCharacterIds: ids.filter(
          (id) => !leftFeatured.includes(id)
        ),
        rightPageBackgroundCharacterIds: ids.filter(
          (id) => !rightFeatured.includes(id)
        ),
  
        leftPageHiddenCharacterIds: [],
        rightPageHiddenCharacterIds: [],
      };
    }
  
    return {
      diagnosis: [
        "The spread likely needs stronger identity matching for the core featured characters.",
        "Reducing visual competition should help Gemini preserve faces and outfits more faithfully.",
      ],
      strategy: "identity_repair",
      executionMode: "single_spread_identity_repair",
      keepUnifiedSpread: true,
      splitIntoTwoPages: false,
  
      featuredCharacterIds: featuredIds,
      backgroundCharacterIds: backgroundIds,
      hiddenCharacterIds: [],
  
      recommendedPrompt: [
        `Redraw ${context.spreadLabel} with stronger identity matching for the featured characters.`,
        `Prioritise face shape, hairstyle, age, proportions, outfit consistency, and clear separation between named characters.`,
        `Keep the overall story beat and setting, but simplify visual competition so the main child remains unmistakable.`,
      ].join(" "),
  
      notesToUser: assistantMessage,
    };
  }

  function buildSystemPrompt() {
    return [
      "You are FlipWhizz's redraw strategist.",
      "Your job is to review a children's storybook illustration spread, discuss problems with the user, and produce a high-quality redraw plan for Gemini image generation.",
      "You are NOT the image generator. You are the art director and prompt strategist.",
      "",
      "Goals in priority order:",
      "1. Preserve the identity of the main child and other featured characters.",
      "2. Detect identity drift, duplicate-looking characters, cast overload, outfit drift, composition overload, and location drift.",
      "3. Decide whether the redraw should be:",
      "   - a single spread with identity repair,",
      "   - a single spread with reduced cast emphasis, or",
      "   - two linked single-page illustrations.",
      "4. Produce Gemini-ready prompt instructions for the chosen branch.",
      "",
      "Branching rule:",
      "- If the scene can still work as one spread with only 2-3 exact featured characters, prefer a single-spread branch.",
      "- If more than 3 clearly readable identities still need to matter after simplification, prefer split_into_two_pages.",
      "",
      "Rules:",
      "- Be concise, perceptive, and concrete.",
      "- Do not ask too many questions if you can already diagnose the problem.",
      "- Keep recommendations operational, not abstract.",
      "- Never invent story facts that are not in context.",
      "",
      "Output format:",
      "Return plain text with exactly these two XML tags:",
      "<assistant_reply>Your conversational chat response here</assistant_reply>",
      "<redraw_plan_json>{...valid JSON only...}</redraw_plan_json>",
      "",
      "The <assistant_reply> is your conversational response in the chat (asking questions, acknowledging the issue).",
      "The notesToUser inside the plan is a separate, standalone summary of what the redraw will do — written so the user feels confident hitting 'Redraw'.",
      "<redraw_plan_json>{...valid JSON only...}</redraw_plan_json>",
      "",
      "Important: the notesToUser field is the ONLY thing the user will see from the plan.",
      "Write it as a brief, friendly summary of what you'll fix — as if talking to a parent, not a developer.",
      "Example: 'I'll make Sophia's face much clearer and push the other characters into the background so she really stands out. Everything else — the bedroom, the outfits, the nighttime lighting — stays the same.'",
      "Keep it to 1-3 sentences. No jargon, no character IDs, no technical terms.",
      "",
      "The redraw_plan_json must match this shape exactly:",
      JSON.stringify(
        {
          diagnosis: ["string"],
          strategy:
            "standard_redraw | identity_repair | cast_simplification | split_into_two_pages",
          executionMode:
            "single_spread_identity_repair | single_spread_with_reduced_cast | split_into_two_single_pages",
          keepUnifiedSpread: true,
          splitIntoTwoPages: false,
          featuredCharacterIds: ["character-id"],
          backgroundCharacterIds: ["character-id"],
          hiddenCharacterIds: ["character-id"],
          outfitOverrides: { "character-id": "outfit_key" },
          recommendedPrompt: "string",
          notesToUser: "string",
          leftPagePrompt: "string",
          rightPagePrompt: "string",
          leftPageFeaturedCharacterIds: ["character-id"],
          rightPageFeaturedCharacterIds: ["character-id"],
          leftPageBackgroundCharacterIds: ["character-id"],
          rightPageBackgroundCharacterIds: ["character-id"],
          leftPageHiddenCharacterIds: ["character-id"],
          rightPageHiddenCharacterIds: ["character-id"],
        },
        null,
        2
      ),
    ].join("\n");
  }

function buildContextXml(context: StrategistContext) {
  const charactersXml = context.characters
    .map(
      (c) => `
      <character>
        <id>${xmlEscape(c.characterId)}</id>
        <name>${xmlEscape(c.name)}</name>
        <role>${xmlEscape(c.role ?? "")}</role>
        <outfit_key>${xmlEscape(c.outfitKey ?? "")}</outfit_key>
        <image_url>${xmlEscape(c.imageUrl ?? "")}</image_url>
      </character>
    `.trim()
    )
    .join("\n");

  const locationsXml = (context.locations ?? [])
    .map(
      (l) => `
      <location>
        <id>${xmlEscape(l.id)}</id>
        <name>${xmlEscape(l.name)}</name>
        <image_url>${xmlEscape(l.imageUrl ?? "")}</image_url>
      </location>
    `.trim()
    )
    .join("\n");

  return `
<flipwhizz_redraw_context>
  <story_title>${xmlEscape(context.storyTitle)}</story_title>
  <spread_label>${xmlEscape(context.spreadLabel)}</spread_label>
  <scene_summary>${xmlEscape(context.sceneSummary ?? "")}</scene_summary>
  <left_page_text>${xmlEscape(context.leftPageText ?? "")}</left_page_text>
  <right_page_text>${xmlEscape(context.rightPageText ?? "")}</right_page_text>
  <style_guide_label>${xmlEscape(context.styleGuideLabel ?? "")}</style_guide_label>
  <style_guide_summary>${xmlEscape(context.styleGuideSummary ?? "")}</style_guide_summary>
  <current_spread_image_url>${xmlEscape(context.currentSpreadImageUrl ?? "")}</current_spread_image_url>

  <characters>
    ${charactersXml}
  </characters>

  <locations>
    ${locationsXml}
  </locations>
</flipwhizz_redraw_context>
  `.trim();
}

function buildConversationSummary(messages: StrategistMessage[]) {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

async function makeImageContentBlock(url: string) {
  return {
    type: "image" as const,
    source: {
      type: "url" as const,
      url,
    },
  };
}

async function buildAnthropicUserContent(
  context: StrategistContext,
  messages: StrategistMessage[]
) {
  const content: Array<any> = [];

  console.log("[strategist] 🖼️  Building Anthropic content blocks...");

  if (isHttpUrl(context.currentSpreadImageUrl)) {
    content.push(await makeImageContentBlock(context.currentSpreadImageUrl));
    console.log("[strategist] 📸 Added spread image:", context.currentSpreadImageUrl.slice(0, 80));
  } else {
    console.log("[strategist] ⚠️ No spread image URL available");
  }

  let charImageCount = 0;
  for (const character of context.characters.slice(0, 8)) {
    if (isHttpUrl(character.imageUrl)) {
      content.push({
        type: "text",
        text: `Character reference: ${character.name}${
          character.role ? ` (${character.role})` : ""
        }${character.outfitKey ? `, outfit: ${character.outfitKey}` : ""}`,
      });
      content.push(await makeImageContentBlock(character.imageUrl));
      charImageCount++;
      console.log(`[strategist] 👤 Added character image: ${character.name} (${character.imageUrl.slice(0, 60)}...)`);
    } else {
      console.log(`[strategist] ⚠️ Character "${character.name}" has no image URL: ${character.imageUrl}`);
    }
  }
  console.log(`[strategist] 📊 Total character images added: ${charImageCount}/${context.characters.length}`);

  let locImageCount = 0;
  for (const location of (context.locations ?? []).slice(0, 3)) {
    if (isHttpUrl(location.imageUrl)) {
      content.push({
        type: "text",
        text: `Location reference: ${location.name}`,
      });
      content.push(await makeImageContentBlock(location.imageUrl));
      locImageCount++;
      console.log(`[strategist] 📍 Added location image: ${location.name}`);
    }
  }
  console.log(`[strategist] 📊 Total location images added: ${locImageCount}/${(context.locations ?? []).length}`);

  content.push({
    type: "text",
    text: [
      "Here is the loaded redraw context:",
      buildContextXml(context),
      "",
      "Here is the conversation so far:",
      buildConversationSummary(messages),
      "",
      "Now produce your reply and redraw plan.",
    ].join("\n\n"),
  });

  console.log(`[strategist] 📦 Total content blocks: ${content.length}`);
  console.log(`[strategist] 📝 Messages in conversation: ${messages.length}`);

  return content;
}

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const startTime = Date.now();

  console.log("\n" + "=".repeat(70));
  console.log(`[strategist] 🚀 POST /api/stories/${storyId}/redraw-strategist`);
  console.log("=".repeat(70));

  try {
    const body = await req.json();
    
    console.log("[strategist] 📥 Request body keys:", Object.keys(body));
    console.log("[strategist] 📥 spreadId:", body.spreadId);
    console.log("[strategist] 📥 Message count:", body.messages?.length);
    console.log("[strategist] 📥 Context spread:", body.context?.spreadLabel);
    console.log("[strategist] 📥 Context characters:", body.context?.characters?.length);
    console.log("[strategist] 📥 Context locations:", body.context?.locations?.length);
    
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      console.log("[strategist] ❌ Request validation failed:", JSON.stringify(parsed.error.flatten()));
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { context, messages } = parsed.data;

    console.log("[strategist] ✅ Request validated");
    console.log("[strategist] 📋 Context summary:", {
      storyTitle: context.storyTitle,
      spreadLabel: context.spreadLabel,
      hasSpreadImage: !!context.currentSpreadImageUrl,
      hasSceneSummary: !!context.sceneSummary,
      hasLeftText: !!context.leftPageText,
      hasRightText: !!context.rightPageText,
      hasStyleGuide: !!context.styleGuideSummary,
      characterCount: context.characters.length,
      characterNames: context.characters.map(c => c.name).join(", "),
      charactersWithImages: context.characters.filter(c => isHttpUrl(c.imageUrl)).length,
      locationCount: (context.locations ?? []).length,
    });
    
    console.log("[strategist] 💬 Conversation:", messages.map(m => ({
      role: m.role,
      contentPreview: m.content.slice(0, 80) + (m.content.length > 80 ? "..." : ""),
    })));

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("[strategist] ❌ Missing ANTHROPIC_API_KEY");
      return NextResponse.json(
        { error: "Missing ANTHROPIC_API_KEY" },
        { status: 500 }
      );
    }

    const anthropicModel =
      process.env.ANTHROPIC_STRATEGIST_MODEL || "claude-sonnet-4-6";
    
    console.log("[strategist] 🤖 Using model:", anthropicModel);

    const anthropicUserContent = await buildAnthropicUserContent(context, messages);

    const anthropicRequestBody = {
      model: anthropicModel,
      max_tokens: 1800,
      temperature: 0.3,
      cache_control: { type: "ephemeral" },
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: anthropicUserContent,
        },
      ],
    };

    console.log("[strategist] 📤 Sending to Anthropic...");
    console.log("[strategist] 📤 Model:", anthropicModel);
    console.log("[strategist] 📤 Max tokens:", 1800);
    console.log("[strategist] 📤 Content blocks:", anthropicUserContent.length);
    console.log("[strategist] 📤 System prompt length:", buildSystemPrompt().length, "chars");

    const anthropicStart = Date.now();

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicRequestBody),
    });

    const anthropicLatency = Date.now() - anthropicStart;
    console.log(`[strategist] ⏱️  Anthropic response: ${anthropicRes.status} in ${anthropicLatency}ms`);

    const anthropicData = await anthropicRes.json().catch(() => null);

    if (!anthropicRes.ok) {
      console.log("[strategist] ❌ Anthropic error:", JSON.stringify(anthropicData).slice(0, 500));
      return NextResponse.json(
        {
          error: "Anthropic strategist request failed",
          status: anthropicRes.status,
          details: anthropicData,
        },
        { status: 502 }
      );
    }

    // Log usage
    if (anthropicData?.usage) {
      console.log("[strategist] 📊 Anthropic usage:", {
        inputTokens: anthropicData.usage.input_tokens,
        outputTokens: anthropicData.usage.output_tokens,
        cacheCreationTokens: anthropicData.usage.cache_creation_input_tokens,
        cacheReadTokens: anthropicData.usage.cache_read_input_tokens,
      });
    }

    const rawText = extractTextFromAnthropicResponse(anthropicData);

    console.log("[strategist] 📝 Raw response length:", rawText.length, "chars");
    console.log("[strategist] 📝 Raw response preview:", rawText.slice(0, 200));
    console.log("[strategist] 📝 Has <assistant_reply> tag:", rawText.includes("<assistant_reply>"));
    console.log("[strategist] 📝 Has <redraw_plan_json> tag:", rawText.includes("<redraw_plan_json>"));

    if (!rawText) {
      console.log("[strategist] ❌ No text in Anthropic response");
      console.log("[strategist] 📋 Full response data:", JSON.stringify(anthropicData).slice(0, 500));
      return NextResponse.json(
        { error: "Anthropic returned no text output" },
        { status: 502 }
      );
    }

    const taggedAssistantReply =
      extractTaggedBlock(rawText, "assistant_reply") ?? rawText.trim();

    console.log("[strategist] 💬 Assistant reply preview:", taggedAssistantReply.slice(0, 150));

    const latestUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const plan =
      safeParsePlan(rawText, context) ??
      buildFallbackPlan(context, latestUserMessage, taggedAssistantReply);

    console.log("[strategist] 📊 Final plan:", {
      strategy: plan.strategy,
      executionMode: plan.executionMode,
      keepUnifiedSpread: plan.keepUnifiedSpread,
      splitIntoTwoPages: plan.splitIntoTwoPages,
      featuredCount: plan.featuredCharacterIds.length,
      backgroundCount: plan.backgroundCharacterIds.length,
      hiddenCount: plan.hiddenCharacterIds.length,
      hasLeftPrompt: !!plan.leftPagePrompt,
      hasRightPrompt: !!plan.rightPagePrompt,
      promptPreview: plan.recommendedPrompt.slice(0, 100),
    });

    const totalLatency = Date.now() - startTime;
    console.log(`[strategist] ✅ Complete in ${totalLatency}ms (Anthropic: ${anthropicLatency}ms)`);
    console.log("=".repeat(70) + "\n");

    return NextResponse.json({
      ok: true,
      storyId,
      assistantMessage: {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: taggedAssistantReply,
      },
      plan,
      model: anthropicModel,
    });
  } catch (error: any) {
    const totalLatency = Date.now() - startTime;
    console.log(`[strategist] ❌ EXCEPTION after ${totalLatency}ms:`, error?.message || error);
    console.log("[strategist] 📋 Stack:", error?.stack?.slice(0, 300));
    
    return NextResponse.json(
      {
        error: error?.message || "Unexpected strategist error",
      },
      { status: 500 }
    );
  }
}
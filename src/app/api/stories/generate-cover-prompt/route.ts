import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  characters,
  locations,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const runtime = "nodejs";

/* ======================================================
   TYPES
====================================================== */
// A summary of decisions for the UI side panel
export type DesignBriefSummary = {
  frontCover?: { mood?: string; scene?: string };
  backCover?: { strategy?: string };
  titlePage?: { style?: string };
};

// The structure of the hidden JSON block from Claude
type ChatStateJson = {
  stage:
    | "intro"
    | "front-cover"
    | "back-cover"
    | "title-page"
    | "confirmation"
    | "ready";
  suggestedReplies: string[];
  briefSummary: DesignBriefSummary;
};

type CoverDecisions = {
  frontCover?: {
    emotion?: string;
    scene?: string;
    characters?: string[];
    characterAction?: string;
    characterEmotion?: string;
    setting?: string;
    timeOfDay?: string;
    colorMood?: string;
    composition?: string;
  };
  backCover?: {
    strategy?: "extended" | "secondary" | "pattern";
    description?: string;
    blurb?: string;
  };
  titlePage?: {
    dedicationType?: "personal" | "decorative" | "quote";
    dedicationText?: string;
    visualStyle?: string;
  };
  personalization?: {
    showReaderName?: boolean;
    nameLocation?: string;
  };
};

/* ======================================================
   MAIN HANDLER
====================================================== */

export async function POST(req: Request) {
  try {
    const { storyId, conversationHistory, mode } = await req.json();

    // Mode: "chat" or "generate"
    if (mode === "generate") {
      return await generateFinalPrompts(storyId, conversationHistory);
    }

    return await handleChatMessage(storyId, conversationHistory);
  } catch (err) {
    console.error("Cover chat error:", err);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

/* ======================================================
   CHAT HANDLER
====================================================== */

async function handleChatMessage(storyId: string, conversationHistory: any[]) {
  // Load story context
  const context = await loadStoryContext(storyId);

  const systemPrompt = buildChatSystemPrompt(context);

  // Clean the conversation history to only include role and content
  const cleanMessages = conversationHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemPrompt,
    messages: cleanMessages,
  });

  const fullContent = response.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n");

  // --- Extract Structured Data ---
  const jsonBlockMatch = fullContent.match(/```json:state\s*([\s\S]*?)\s*```/);
  let messageText = fullContent;
  let chatState: ChatStateJson = {
    stage: "intro",
    suggestedReplies: [],
    briefSummary: {},
  };

  if (jsonBlockMatch) {
    try {
      chatState = JSON.parse(jsonBlockMatch[1]);
      // Remove the JSON block from the text shown to the user
      messageText = fullContent.replace(jsonBlockMatch[0], "").trim();
    } catch (e) {
      console.error("Failed to parse chat state JSON", e);
    }
  }

  return NextResponse.json({
    message: messageText,
    stage: chatState.stage,
    suggestedReplies: chatState.suggestedReplies,
    briefSummary: chatState.briefSummary,
  });
}

/* ======================================================
   FINAL PROMPT GENERATION
====================================================== */

async function generateFinalPrompts(
  storyId: string,
  conversationHistory: any[]
) {
  const context = await loadStoryContext(storyId);
  
  // Extract decisions from conversation
  const decisions = await extractDecisions(conversationHistory, context);
  
  // Generate three separate prompts
  const frontCoverPrompt = buildFrontCoverPrompt(decisions, context);
  const backCoverPrompt = buildBackCoverPrompt(decisions, context);
  const titlePagePrompt = buildTitlePagePrompt(decisions, context);

  // Save prompts to database
  await db
    .update(stories)
    .set({
      frontCoverPrompt,
      backCoverPrompt,
      updatedAt: new Date(),
    })
    .where(eq(stories.id, storyId));

  return NextResponse.json({
    frontCoverPrompt,
    backCoverPrompt,
    titlePagePrompt,
    decisions,
  });
}

/* ======================================================
   CONTEXT LOADING
====================================================== */

async function loadStoryContext(storyId: string) {
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) throw new Error("Story not found");

  // Load first 3 pages for scene context
  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
    limit: 3,
  });

  // Load characters
  const storyChars = await db.query.storyCharacters.findMany({
    where: eq(storyCharacters.storyId, storyId),
    with: {
      character: true,
    },
  });

  const chars = storyChars.map((sc) => ({
    id: sc.character.id,
    name: sc.character.name,
    description: sc.character.description,
    appearance: sc.character.appearance,
    visualDetails: sc.character.visualDetails,
    role: sc.role,
  }));

  // Load locations
  const storyLocs = await db.query.storyLocations.findMany({
    where: eq(storyLocations.storyId, storyId),
    with: {
      location: true,
    },
  });

  const locs = storyLocs.map((sl) => ({
    id: sl.location.id,
    name: sl.location.name,
    description: sl.location.description,
    visualDetails: sl.location.visualDetails,
    significance: sl.significance,
  }));

  // Load style guide
  const styleGuide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  return {
    story,
    pages,
    characters: chars,
    locations: locs,
    styleGuide,
  };
}

/* ======================================================
   SYSTEM PROMPT BUILDER
====================================================== */

function buildChatSystemPrompt(context: any): string {
  const { story, pages, characters, locations, styleGuide } = context;

  return `You are an expert children's book cover designer having a conversation to design the perfect front cover, back cover, and title page.

STORY INFORMATION:
Title: "${story.title}"
Description: ${story.description || "Not provided"}
Tone: ${story.tone || "Not specified"}

OPENING PAGES:
${pages.map((p: any) => `Page ${p.pageNumber}: ${p.text}`).join("\n")}

CHARACTERS:
${characters
  .map(
    (c: any) => `- ${c.name} (${c.role || "character"}): ${
      c.description || "No description"
    }
  Appearance: ${c.appearance || "Not specified"}`
  )
  .join("\n")}

LOCATIONS:
${locations
  .map((l: any) => `- ${l.name}: ${l.description || "No description"}`)
  .join("\n")}

STYLE GUIDE:
${styleGuide?.summary || "Not defined"}
Art Style: ${styleGuide?.artStyle || "Not specified"}

YOUR ROLE:
1. Guide the user through cover design decisions conversationally
2. Ask ONE clear question at a time
3. Offer 2-3 specific, creative options based on the story
4. Be enthusiastic and visual in your descriptions
5. Build on previous decisions

CONVERSATION FLOW & OUTPUT STRUCTURE:
You must track the conversation stage and summarizing decisions.
At the VERY END of every response, you MUST include a hidden JSON block with the current state.

The JSON block must look exactly like this:
\`\`\`json:state
{
  "stage": "intro" | "front-cover" | "back-cover" | "title-page" | "confirmation" | "ready",
  "suggestedReplies": ["Short reply 1", "Short reply 2", "Short reply 3"],
  "briefSummary": {
    "frontCover": { "mood": "summary of mood", "scene": "summary of scene" },
    "backCover": { "strategy": "summary of strategy" },
    "titlePage": { "style": "summary of style" }
  }
}
\`\`\`
- "suggestedReplies": Provide 2-3 short, clickable replies the user might say to answer your question.
- "briefSummary": Update this object with concise summaries of decisions already made. Leave fields null if not yet decided.
- "stage": Update based on what you are currently discussing. When you have all necessary info and are asking for final confirmation, set stage to "confirmation". When the user confirms, set stage to "ready".

YOUR OPENING MESSAGE:
Congratulate the user, mention something specific you like about the story, and then propose a concrete front cover idea. Ask for their thoughts.
(Remember to end with the \`\`\`json:state\`\`\` block, stage: "intro", with relevant suggested replies and empty summary).
`;
}

/* ======================================================
   DECISION EXTRACTION
====================================================== */

async function extractDecisions(
  conversationHistory: any[],
  context: any
): Promise<CoverDecisions> {
  const prompt = `Based on this conversation about designing book covers, extract the user's decisions into a structured format.

Return ONLY valid JSON with this structure:
{
  "frontCover": {
    "emotion": "string",
    "scene": "description of chosen scene",
    "characters": ["character names"],
    "characterAction": "what they're doing",
    "characterEmotion": "how they look",
    "setting": "location/environment",
    "timeOfDay": "morning/afternoon/evening/night",
    "colorMood": "warm/cool/vibrant/muted description",
    "composition": "layout description"
  },
  "backCover": {
    "strategy": "extended|secondary|pattern",
    "description": "visual description",
    "blurb": "back cover text"
  },
  "titlePage": {
    "dedicationType": "personal|decorative|quote",
    "dedicationText": "actual dedication text if provided",
    "visualStyle": "description"
  },
  "personalization": {
    "showReaderName": boolean,
    "nameLocation": "where name appears"
  }
}

Only include fields that were actually decided. If something wasn't discussed, omit it.`;

  // Clean the conversation history to only include role and content
  const cleanMessages = conversationHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: prompt,
    messages: cleanMessages,
  });

  const content = response.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {};
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

/* ======================================================
   PROMPT BUILDERS
====================================================== */

function buildFrontCoverPrompt(
  decisions: CoverDecisions,
  context: any
): string {
  const { story, characters, locations, styleGuide } = context;
  const fc = decisions.frontCover || {};

  // Build character descriptions
  const charDescriptions = (fc.characters || [])
    .map((name) => {
      const char = characters.find(
        (c: any) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (!char) return null;

      return `${char.name}: ${char.appearance || char.description}
Visual: ${JSON.stringify(char.visualDetails || {})}`;
    })
    .filter(Boolean)
    .join("\n");

  return `Create a professional children's book FRONT COVER illustration.

BOOK TITLE: "${story.title}"

ART STYLE:
${styleGuide?.summary || "Warm, illustrated children's book style"}
Style: ${styleGuide?.artStyle || "Digital illustration"}
Color Palette: ${JSON.stringify(styleGuide?.colorPalette || {})}

EMOTIONAL TONE: ${fc.emotion || "Engaging and inviting"}

SCENE: ${fc.scene || "Key moment from the story opening"}

CHARACTERS:
${charDescriptions || "Main character(s) from the story"}
Action: ${fc.characterAction || "Looking at viewer with expression of curiosity"}
Emotion: ${fc.characterEmotion || "Warm, inviting, engaging"}
Composition: ${fc.composition || "Character prominent in foreground, rule of thirds"}

SETTING:
${fc.setting || locations[0]?.name || "Story's primary location"}
Details: ${JSON.stringify(locations[0]?.visualDetails || {})}
Time: ${fc.timeOfDay || "Warm afternoon light"}

COLOR MOOD: ${fc.colorMood || "Warm, inviting, slightly magical"}

TYPOGRAPHY SPACE:
- Reserve top 20% or bottom 20% for title
- Clean, uncluttered area for text overlay
- Title: "${story.title}"

TECHNICAL REQUIREMENTS:
- Professional children's book cover quality
- Print-ready illustration
- Bleed-safe composition (important elements within safe zone)
- Engaging focal point that draws the eye
- Shelf appeal - should stand out among other books

AVOID:
- Any text or words in the illustration
- Overly dark or scary elements
- Photorealistic style
- Cluttered composition
- Cut-off faces or important elements at edges`;
}

function buildBackCoverPrompt(
  decisions: CoverDecisions,
  context: any
): string {
  const { story, styleGuide } = context;
  const bc = decisions.backCover || {};

  let sceneDescription = "";

  if (bc.strategy === "extended") {
    sceneDescription = `Continue the front cover scene, showing what happens next or revealing more of the environment. Maintain visual continuity with the front cover.`;
  } else if (bc.strategy === "secondary") {
    sceneDescription = `Show a different exciting moment from the story: ${bc.description || "A complementary scene that hints at adventure"}`;
  } else {
    sceneDescription = `Create a decorative pattern featuring story elements, character silhouettes, or thematic motifs arranged beautifully across the back cover.`;
  }

  return `Create a professional children's book BACK COVER illustration.

ART STYLE:
${styleGuide?.summary || "Warm, illustrated children's book style"}
Must match front cover style exactly.

VISUAL STRATEGY: ${bc.strategy || "extended"}
${sceneDescription}

BACK COVER BLURB TEXT (for reference, but DO NOT illustrate text):
"${bc.blurb || story.description || "An exciting story awaits inside..."}"

LAYOUT REQUIREMENTS:
- Top 60% can be illustrated
- Bottom 40% must be relatively clear/simple for text overlay
- Bottom right corner: 2" x 1.5" clear zone for barcode
- Middle section: space for blurb text (will be added later)

COLOR & MOOD:
- Harmonize with front cover palette
- Slightly softer or more atmospheric than front
- Maintain the story's emotional tone

TECHNICAL:
- Print-ready quality
- Bleed-safe margins
- Professional finish
- Complements front cover

AVOID:
- Any text or words
- Covering the barcode zone
- Overly busy center area where text will go
- Disconnected style from front cover`;
}

function buildTitlePagePrompt(
  decisions: CoverDecisions,
  context: any
): string {
  const { story, characters, styleGuide } = context;
  const tp = decisions.titlePage || {};

  let visualDirection = "";

  if (tp.dedicationType === "decorative") {
    visualDirection = `Create an elegant decorative frame or border with thematic elements from the story. Include small character silhouettes or story symbols.`;
  } else if (tp.dedicationType === "quote") {
    visualDirection = `Create a simple, elegant vignette with a key story element (object, location detail, or character portrait) that sets the tone.`;
  } else {
    visualDirection = `Create a soft, heartwarming character portrait or small scene with plenty of white space for a dedication message.`;
  }

  return `Create a children's book TITLE PAGE (inside front cover) illustration.

ART STYLE:
${styleGuide?.summary || "Warm, illustrated children's book style"}
Should match the cover style but be softer and more elegant.

VISUAL APPROACH: ${tp.dedicationType || "decorative"}
${visualDirection}
${tp.visualStyle || ""}

DEDICATION: ${tp.dedicationText ? `"${tp.dedicationText}"` : "Space for personal dedication"}

LAYOUT:
- Generous white space (50-60% of page)
- Illustration can be vignette, border, or corner decoration
- Clean area in upper-center for title
- Clean area in lower-center for dedication text
- Elegant, not overwhelming

MOOD:
- Warm and inviting
- Sophisticated but playful
- Sets anticipation for the story

TECHNICAL:
- Lighter, airier than cover illustrations
- Sophisticated negative space use
- Print-ready quality
- Works well with text overlay

AVOID:
- Overly busy or dense composition
- Any text (title and dedication added separately)
- Dark or heavy elements
- Photorealism`;
}

export { buildFrontCoverPrompt, buildBackCoverPrompt, buildTitlePagePrompt };
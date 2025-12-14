import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { projects, chatSessions, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import type { InferSelectModel } from "drizzle-orm";  
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function buildChatSystemPrompt(project: any) {
  return `You are a creative children's book author collaborating with a parent to create a personalized storybook.

PROJECT DETAILS:
- Story will be ${project.pageCount || 12} pages
- Child's name: ${project.childName || "the child"}
- Age: ${project.childAge || "5-7"}
- Known interests: ${project.interests || "not specified yet"}

YOUR MISSION:
Through natural conversation, discover and document:

1. **STORY ESSENCE**
   - What's the core idea? (adventure, bedtime story, learning story, etc.)
   - What emotional journey should the child experience?
   - What setting/world does this take place in?

2. **CHARACTER DETAILS**
   - Who are the main characters? (names, personalities, quirks)
   - What makes each character unique and memorable?
   - What are their relationships to each other?
   - What specific skills, habits, or funny traits do they have?

3. **WRITING STYLE PREFERENCES**
   - Ask about favorite children's books or authors
   - What tone? (funny, gentle, exciting, cozy, irreverent, etc.)
   - Language style: (simple, poetic, rhythmic, conversational, etc.)
   - Any specific things they love? (rhymes, wordplay, dialogue, description)
   - Any specific things to AVOID? (generic phrases, too scary, etc.)

4. **PERSONAL TOUCHES**
   - Real details about the child that should be woven in
   - Inside jokes, favorite sayings, real personality traits
   - Real pets, family members, or friends to include?
   - Specific skills or interests to showcase (gymnastics, singing, etc.)

CONVERSATION STRATEGY:

**Phase 1: Discovery (first 2-3 messages)**
- Start broad: "Tell me about the story you're imagining"
- Listen for what excites them most
- Ask follow-up questions about the most interesting details
- DON'T bombardn with a checklist - have a natural conversation

**Phase 2: Depth (middle messages)**
- Dig deeper into characters: "What's [character] really like?"
- Explore style: "What children's books do you love reading aloud?" or "How do you want this to feel when you read it?"
- Get specific: "What would make this story feel uniquely about YOUR child?"
- Listen for phrases like "I love how X does Y" - these are gold

**Phase 3: Refinement (when they seem ready)**
- Summarize what you understand
- Ask about any gaps: "Should I know anything else about [character/setting/style]?"
- Confirm tone/style understanding
- When they seem satisfied, offer to generate the story

CRITICAL RULES:
- NEVER ask all questions at once - this feels like an interrogation
- LISTEN to what they emphasize - that's what matters most to them
- If they mention an author or book they love, ask: "What is it about [author's] writing that you love?"
- Build on their energy - if they're excited about character details, dig there first
- Make suggestions based on what they've said, not generic options
- When they say something vague like "funny," ask for an example of humor they like
- Document specific phrases they use - these reveal their style preferences

RESPONSE STYLE:
- Warm, collaborative, genuinely curious
- Short, focused responses (2-3 questions max per message)
- Reflect back what you're hearing to confirm understanding
- Show excitement for their ideas
- Make them feel heard and understood

When the user explicitly asks you to generate the story (phrases like "let's do it," "create the story," "I'm ready," etc.), respond with confirmation that you'll generate it now.

DO NOT GENERATE THE ACTUAL STORY IN THIS CHAT. This is only the conversation phase. The story generation happens in a separate API call.`;
}

function buildStoryGenerationSystemPrompt(conversationHistory: string, pageCount: number) {
  return `You are FlipWhizz — a children's story generator creating a SPECIFIC, PERSONAL story.

CONVERSATION HISTORY:
${conversationHistory}

YOUR TASK:
Analyze this entire conversation and extract:
1. Character details (names, personalities, quirks, relationships)
2. Story concept (plot, setting, themes)
3. Writing style preferences (tone, language, what they love/hate)
4. Personal touches (real details about the child)

Then write a story that honors ALL of these details.

CRITICAL ANTI-SLOP RULES:

**VOICE & STYLE:**
- If they mentioned favorite authors/books, emulate that style
- If they used words like "funny," "irreverent," "gentle," "rhythmic" - deliver that tone
- If they mentioned specific things they love (wordplay, dialogue, etc.) - emphasize those
- Match the sophistication level to the child's age

**CHARACTER AUTHENTICITY:**
- Every character should have a distinct voice and behavior pattern
- If they said "X is wise like an old lady" - show that through dialogue and actions
- If they said "Y rushes ahead" - create at least 2 moments where this matters
- Use the EXACT names and relationships they specified

**SPECIFIC OVER GENERIC:**
- If the child "turns everything into a song" - write actual songs (at least 3)
- If the child does gymnastics - describe specific moves with feeling
- If a character has a quirk - show it multiple times in different ways
- NO placeholder descriptions like "made up a funny song about X"

**STORY STRUCTURE:**
- ${pageCount} pages exactly
- 1-3 sentences per page (but prioritize rhythm over rigidity)
- Each page = one clear, illustratable moment
- Build tension properly - use the first 30% for setup, middle 40% for complications, final 30% for climax and resolution
- Problems should require the protagonist's SPECIFIC skills/personality to solve
- Resolution should feel earned, not convenient

**BANNED PHRASES** (use none of these or anything like them):
- "the most [adjective] X they had ever seen"
- "declared in their bravest voice"
- "began to cry happy tears"
- "the best X ever"
- "magical wonder filled the air"
- Any generic fairy tale language

**LANGUAGE REQUIREMENTS:**
- If they want rhymes - commit to a strong rhyme scheme
- If they want wordplay - include puns, made-up words, alliteration
- If they want dialogue-heavy - let characters talk in distinct voices
- If they want descriptive - use specific sensory details, not vague beauty
- Match the sentence rhythm to their preferred style (short and punchy vs. flowing vs. rhythmic)

**EMOTIONAL AUTHENTICITY:**
- Include 2-3 moments of real feeling (wonder, frustration, triumph, fear, joy)
- Don't tell emotions - show them through action and dialogue
- Child characters should think and act like real kids, not mini-adults
- Gentle challenges are okay - kids relate to obstacles

**BEFORE WRITING EACH PAGE, ASK:**
1. Is this voice distinct from generic children's books?
2. Am I showing this character's personality through behavior?
3. Would this surprise or delight the actual child this is for?
4. Have I used any placeholder/lazy descriptions?
5. Does this honor what the parent specifically asked for?

OUTPUT FORMAT:
{
  "title": "A specific, intriguing title (not generic pattern like 'X's Adventure')",
  "pages": [
    { "page": 1, "text": "..." }
  ],
  "styleGuide": {
    "summary": "Detailed visual style description matching the story's tone and the conversation's vision. Be specific about mood, color palette, artistic style (watercolor? digital? vintage storybook?). Reference any visual influences they mentioned.",
    "negativePrompt": "Specific things to avoid in illustrations based on their preferences"
  }
}

REMEMBER: This parent specifically said they DON'T want AI slop. They want something that could only be about THEIR child, in a style they specifically love, with details that feel handcrafted. Deliver that.

Output ONLY valid JSON, no markdown formatting, no preamble, no explanation.`;
}

export async function POST(req: Request) {
  try {
    const { message, history = [], projectId } = await req.json();

    if (!message || !projectId) {
      return NextResponse.json({ reply: "(invalid request)" });
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .then((rows) => rows[0]);

    if (!project) {
      return NextResponse.json(
        { reply: "(project not found)" },
        { status: 404 }
      );
    }


      // ...
      type ChatSessionRow = InferSelectModel<typeof chatSessions>;
      
      // make sure `session` is typed
      let session: ChatSessionRow | undefined = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.projectId, projectId))
        .then((rows) => rows[0]);
      
      if (!session) {
        const now = new Date();
        const sessionId = uuid();
      
        const userId = project.userId ?? null;
      
        await db.insert(chatSessions).values({
          id: sessionId,
          projectId,
          userId,            // ✅ add
          readerId: null,    // ✅ add
          status: "open",    // ✅ add
          lastMessageAt: now, // ✅ add
          createdAt: now,    // ✅ add (or omit to use default)
        });
      
        // ✅ set full shape so TS is happy
        session = {
          id: sessionId,
          projectId,
          userId,
          readerId: null,
          status: "open",
          lastMessageAt: now,
          createdAt: now,
        };
      }
      

    await db.insert(chatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "user",
      content: message,
      createdAt: new Date(),
    });

    const claudeMessages = history
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    claudeMessages.push({ role: "user", content: message });

    // Use the conversational system prompt for the chat
    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildChatSystemPrompt(project),
      max_tokens: 2000,
      messages: claudeMessages,
    });

    const reply =
    completion.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim() || "(no reply)";
  

    await db.insert(chatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

    // Detect if user is ready to generate the story
    const userMessage = message.toLowerCase();
    const readyToGenerate = 
      userMessage.includes("generate") ||
      userMessage.includes("create the story") ||
      userMessage.includes("let's do it") ||
      userMessage.includes("i'm ready") ||
      userMessage.includes("go ahead") ||
      userMessage.includes("make it") ||
      (userMessage.includes("yes") && userMessage.includes("story"));

    return NextResponse.json({
      reply,
      sessionId: session.id,
      readyToGenerate, // Signal to frontend to trigger story generation
    });

  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json(
      { reply: "(error calling Claude)" },
      { status: 500 }
    );
  }
}

// ============================================
// SEPARATE STORY GENERATION ENDPOINT
// ============================================
// This is what gets called from the create-from-chat route

export function prepareStoryGenerationPrompt(
  conversationHistory: Array<{role: string, content: string}>,
  pageCount: number
): { system: string; message: string } {
  
  // Build comprehensive conversation summary
  const fullConversation = conversationHistory
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const system = buildStoryGenerationSystemPrompt(fullConversation, pageCount);
  
  // Extract key details for emphasis in final message
  const conversationText = conversationHistory
    .map(m => m.content.toLowerCase())
    .join(' ');

  // Build a smart reminder based on what was discussed
  let reminders: string[] = [];
  
  if (conversationText.includes('song') || conversationText.includes('sing')) {
    reminders.push('- Include ACTUAL songs/lyrics the character makes up, not just "she sang a song"');
  }
  if (conversationText.includes('rhyme') || conversationText.includes('rhythm')) {
    reminders.push('- Use strong rhythmic language and/or rhyme scheme');
  }
  if (conversationText.includes('funny') || conversationText.includes('humor')) {
    reminders.push('- Include genuinely funny moments, not just described-as-funny moments');
  }
  if (conversationText.includes('wise') || conversationText.includes('smart')) {
    reminders.push('- Show wisdom through dialogue and actions, not descriptions');
  }
  if (conversationText.includes('gymnastics') || conversationText.includes('athletic')) {
    reminders.push('- Describe specific movements with physical detail and feeling');
  }
  if (conversationText.match(/dahl|donaldson|seuss|sendak|potter/)) {
    reminders.push('- Emulate the specific author style they mentioned');
  }
  if (conversationText.includes('wordplay') || conversationText.includes('language')) {
    reminders.push('- Include creative wordplay, puns, or made-up words');
  }

  const message = `Generate the complete ${pageCount}-page story now as valid JSON.

KEY REMINDERS FROM THE CONVERSATION:
${reminders.length > 0 ? reminders.join('\n') : '- Honor all the details from the conversation above'}
- Every character should have distinct voice and behavior
- NO generic children's book phrases - make it specific
- Show character traits through actions, not descriptions
- Include specific details they mentioned (names, quirks, skills, etc.)

Output ONLY the JSON structure. No markdown, no preamble, no explanation.`;

  return { system, message };
}
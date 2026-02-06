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
  return `You are a children's book author helping a parent create a story for their child.

CONTEXT:
- Child: ${project.childName || "their child"}, age ${project.childAge || "5-7"}
- Story length: ${project.pageCount || 12} pages
- Interests: ${project.interests || "discovering through conversation"}

YOUR APPROACH:
You're having a genuine conversation to understand what story they want to create. This could be:
- A memory from a recent experience (holiday, playdate, special moment)
- A teaching moment (working through something difficult, learning a concept)
- A pure adventure in their child's existing character universe
- Just for fun

Have a natural conversation. Ask 1-2 questions at a time, maximum. Listen for what excites them.

DISCOVER NATURALLY:
- Start by understanding the PURPOSE: "What kind of story are we making today?"
- If it's a MEMORY: Ask about the experience, what made it special, key details
- If it's TEACHING: Ask what they want their child to understand/feel
- If it's FUN: Ask about the adventure, the characters involved

As you talk, gently discover:
- Who's in this story (their child? existing characters? new friends?)
- What happens (the core moment or adventure)
- How it should feel (funny? gentle? exciting? cozy?)
- Any special details (inside jokes, real personality traits)

CRITICAL:
- Keep responses SHORT (2-3 sentences, max 2 questions)
- Sound like a person having a conversation, not following a script
- Build on what they say - don't ignore and move to the next question
- If they mention existing characters, ask about them naturally
- When they seem ready, offer to write the story

TONE:
Warm, collaborative, genuinely interested. Like chatting with a friend who's excited to help.

When they're ready to generate (they say "let's do it," "create it," "I'm ready," etc.), confirm briefly and signal readiness.

DO NOT write the actual story in this chat. That happens separately.`;
}

function buildStoryGenerationSystemPrompt(conversationHistory: string, pageCount: number) {
  return `You are FlipWhizz, creating a children's story based on this conversation:

${conversationHistory}

UNDERSTAND THE PURPOSE:
Read this conversation carefully. What kind of story is this?
- Memory preservation? (capturing a real experience)
- Teaching moment? (helping the child learn/process something)
- Pure fun? (adventure in their universe)

Extract from the conversation:
- Characters (names, personalities, how they act)
- What happens (the core story)
- How it should feel (tone, style)
- Special details (inside jokes, real traits, specific moments)

WRITE THE STORY:
${pageCount} pages. Each page = 1-3 sentences, one illustratable moment.

KEY PRINCIPLES:

1. **Be specific, not generic**
   - Use real details they mentioned
   - If a character has a quirk, show it multiple times
   - If the child does something specific (gymnastics, makes up songs), SHOW it with actual examples

2. **Match their tone**
   - If they said "funny," make it actually funny
   - If they said "gentle," keep it soft
   - If they mentioned favorite books/authors, channel that style

3. **Authentic voice**
   - Characters should sound different from each other
   - Kids should talk/think like real kids, not mini-adults
   - No generic fairy tale language

4. **Real emotions**
   - Include actual feelings, not just described feelings
   - Small challenges are good - kids relate to obstacles
   - Show, don't tell

5. **Story structure**
   - First 30%: Setup
   - Middle 40%: Complication/adventure
   - Final 30%: Resolution
   - Make the resolution feel earned

BANNED PHRASES (avoid anything similar):
- "the most [adjective] ever"
- "declared bravely"
- "magical wonder filled"
- "began to cry happy tears"
- "the best X ever"

FOR TEACHING STORIES:
- Wrap the lesson in adventure, don't preach
- Let the character discover it naturally
- Use their existing characters if mentioned
- Keep it subtle and age-appropriate

FOR MEMORY STORIES:
- Include specific details from the real experience
- Weave in the child's actual personality
- Mix reality with imagination if that was discussed

OUTPUT FORMAT:
{
  "title": "Specific, interesting title (not 'X's Adventure')",
  "pages": [
    { "page": 1, "text": "..." }
  ],
  "styleGuide": {
    "summary": "Visual style matching the story's mood. Be specific about tone, color palette, artistic approach.",
    "negativePrompt": "Things to avoid in illustrations"
  }
}

Before writing each page, ask yourself:
- Does this feel handcrafted for THIS child?
- Am I showing character through action?
- Would this surprise or delight them?
- Have I honored what the parent wanted?

Output ONLY valid JSON. No markdown, no preamble, no explanation.`;
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

    type ChatSessionRow = InferSelectModel<typeof chatSessions>;
    
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
        userId,
        readerId: null,
        status: "open",
        lastMessageAt: now,
        createdAt: now,
      });
    
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

    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildChatSystemPrompt(project),
      max_tokens: 1500,
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
      readyToGenerate,
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

export function prepareStoryGenerationPrompt(
  conversationHistory: Array<{role: string, content: string}>,
  pageCount: number
): { system: string; message: string } {
  
  const fullConversation = conversationHistory
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const system = buildStoryGenerationSystemPrompt(fullConversation, pageCount);
  
  const message = `Generate the complete ${pageCount}-page story now as valid JSON.

Remember:
- Honor all the details from the conversation
- Every character should have a distinct voice and behavior
- NO generic children's book phrases - make it specific to THIS child
- Show character traits through actions, not descriptions
- Include the specific details they mentioned

Output ONLY the JSON structure. No markdown, no preamble, no explanation.`;

  return { system, message };
}
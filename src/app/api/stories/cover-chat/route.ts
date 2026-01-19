// app/api/stories/cover-chat/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories, coverChatSessions, coverChatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});



function buildCoverChatSystemPrompt(story: any) {
  return `You are a cover design consultant helping parents create the perfect book cover for their child's personalized storybook.

STORY DETAILS:
- Title: ${story.title}
- Story Summary: ${story.fullDraft ? story.fullDraft.substring(0, 500) + '...' : 'Adventure story'}

YOUR ROLE:
Through natural conversation, help the parent envision and articulate what they want for both the front and back covers.

COVER DESIGN ELEMENTS TO DISCOVER:

**FRONT COVER:**
1. **Main Visual Focus**
   - Which character(s) should be featured?
   - What are they doing? (action pose, portrait, scene moment)
   - What's the setting/background?
   - Time of day and lighting mood?

2. **Composition & Style**
   - Close-up or full scene?
   - Dynamic action or peaceful moment?
   - Color mood (vibrant, soft, dramatic, cozy)?
   - Any specific visual elements they want (magical effects, weather, props)?

3. **Title Treatment**
   - Where should the title go?
   - What feeling should it convey?

**BACK COVER:**
1. **Visual Elements**
   - Should it show a different scene or continue the front?
   - Include characters or focus on setting?
   - Any preview of the story's journey?

2. **Text Elements**
   - Back cover blurb/description
   - Author info (parent's name, child's name)
   - Age range or dedication

CONVERSATION STRATEGY:
- Start by understanding what moment/feeling they want to capture
- Ask about their favorite page or scene from the story
- Help them visualize specific details (character expressions, backgrounds, lighting)
- Confirm their vision by summarizing back to them
- Be enthusiastic and collaborative
- Keep responses conversational, not like a questionnaire

When they seem satisfied with the direction (usually after 3-5 exchanges), let them know you're ready to generate the covers.

IMPORTANT:
- Keep responses warm and conversational
- Build on their ideas, don't interrogate
- Help them articulate vague ideas into specific visual directions
- Reference their story details when suggesting ideas`;
}

export async function POST(req: Request) {
  try {
    const { message, history = [], storyId } = await req.json();

    if (!message || !storyId) {
      return NextResponse.json({ reply: "(invalid request)" }, { status: 400 });
    }

    // Get story details
    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .then((rows) => rows[0]);

    if (!story) {
      return NextResponse.json({ reply: "(story not found)" }, { status: 404 });
    }

    // Ensure chat session exists
    let session = await db
      .select()
      .from(coverChatSessions)
      .where(eq(coverChatSessions.storyId, storyId))
      .then((rows) => rows[0]);

      if (!session) {
        const [newSession] = await db
          .insert(coverChatSessions)
          .values({
            id: uuid(),
            storyId,
            coverPlan: null,
            planUpdatedAt: null,
            createdAt: new Date(),
          })
          .returning();
      
        session = newSession;
      }
      

    // Save user message
    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "user",
      content: message,
      createdAt: new Date(),
    });

    // Build Claude messages
    const claudeMessages = history
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    claudeMessages.push({ role: "user", content: message });

    // Call Claude
    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildCoverChatSystemPrompt(story),
      max_tokens: 2000,
      messages: claudeMessages,
    });

    const reply =
    completion.content.find((b) => b.type === "text")?.text ??
    "(no reply)";
  

    // Save assistant message
    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

    return NextResponse.json({
      reply,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Cover chat error:", err);
    return NextResponse.json(
      { reply: "(error)" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  coverChatSessions,
  coverChatMessages,
  storyIntent,
  stories,
  characters,
  locations,
  storyStyleGuide,
  projects,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const TOOL_NAME = "emit_cover_chat";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storyId, message } = body;
    const sessionId = body.sessionId ?? null;

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    /* --------------------------------------------------
       1. Load story + project (schema-correct)
    -------------------------------------------------- */
    const storyData = await db
      .select({
        id: stories.id,
        title: stories.title,
        description: stories.description,
        projectId: stories.projectId,
        userId: projects.userId,
        storyBrief: projects.storyBrief,
      })
      .from(stories)
      .innerJoin(projects, eq(stories.projectId, projects.id))
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!storyData) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    /* --------------------------------------------------
       2. Get or create cover chat session
    -------------------------------------------------- */
    let session =
      sessionId &&
      (await db.query.coverChatSessions.findFirst({
        where: eq(coverChatSessions.id, sessionId),
      }));

    if (!session) {
      [session] = await db
        .insert(coverChatSessions)
        .values({
          id: uuid(),
          storyId,
          coverPlan: null,
          createdAt: new Date(),
        })
        .returning();
    }

    /* --------------------------------------------------
       3. Save user message
    -------------------------------------------------- */
    if (message) {
      await db.insert(coverChatMessages).values({
        id: uuid(),
        sessionId: session.id,
        role: "user",
        content: message,
        createdAt: new Date(),
      });
    }

    /* --------------------------------------------------
       4. Load context (schema-safe)
    -------------------------------------------------- */
    const [intentData, charList, locList, styleData, history] =
      await Promise.all([
        db.query.storyIntent.findFirst({
          where: eq(storyIntent.storyId, storyId),
        }),
        storyData.userId
          ? db.query.characters.findMany({
              where: eq(characters.userId, storyData.userId),
            })
          : [],
        storyData.userId
          ? db.query.locations.findMany({
              where: eq(locations.userId, storyData.userId),
            })
          : [],
        db.query.storyStyleGuide.findFirst({
          where: eq(storyStyleGuide.storyId, storyId),
        }),
        db
          .select()
          .from(coverChatMessages)
          .where(eq(coverChatMessages.sessionId, session.id))
          .orderBy(asc(coverChatMessages.createdAt)),
      ]);

    /* --------------------------------------------------
       5. Build prompt context
    -------------------------------------------------- */
    const charContext =
      charList.length > 0
        ? charList
            .map(
              (c) => `
NAME: ${c.name}
DESC: ${c.description}
LOOKS: ${c.appearance}
DETAILS: ${JSON.stringify(c.visualDetails ?? {})}
---`
            )
            .join("\n")
        : "No characters defined.";

    const locContext =
      locList.length > 0
        ? locList.map((l) => `${l.name}: ${l.description}`).join("\n")
        : "No locations defined.";

    const SYSTEM = `
ROLE:
You are a decisive, expert children's book cover designer.

STORY:
Title: "${storyData.title}"
Summary: "${storyData.description || storyData.storyBrief || "None"}"

INTENT:
${intentData ? JSON.stringify(intentData, null, 2) : "None"}

CHARACTERS (USE THESE EXACT VISUALS):
${charContext}

LOCATIONS:
${locContext}

STYLE:
${styleData?.artStyle || "Children's Book Illustration"}

RULES:
- You MUST call the tool "${TOOL_NAME}"
- Do NOT ask for missing character info if provided
- Propose a concrete cover concept
`.trim();

    /* --------------------------------------------------
       6. Claude call
    -------------------------------------------------- */
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM,
      tools: [
        {
          name: TOOL_NAME,
          description: "Submit the cover design plan.",
          input_schema: {
            type: "object",
            required: ["message", "coverPlan"],
            properties: {
              message: { type: "string" },
              coverPlan: { type: "object" },
            },
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages:
        history.length === 0
          ? [{ role: "user", content: "Propose a cover design." }]
          : history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME
    );
    
    if (!toolBlock) {
      return NextResponse.json(
        { error: "AI failed to generate cover plan" },
        { status: 500 }
      );
    }
    
    const payload = toolBlock.input as any;
    

    const mergedPlan = {
      ...(session.coverPlan as any),
      ...(payload.coverPlan ?? {}),
    };

    await db
      .update(coverChatSessions)
      .set({
        coverPlan: mergedPlan,
        planUpdatedAt: new Date(),
      })
      .where(eq(coverChatSessions.id, session.id));

    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: payload.message,
      createdAt: new Date(),
    });

    return NextResponse.json({
      reply: payload.message,
      sessionId: session.id,
      coverPlan: mergedPlan,
    });
  } catch (err: any) {
    console.error("Cover chat error:", err);
    return NextResponse.json(
      { error: "Cover chat failed", details: err.message },
      { status: 500 }
    );
  }
}

// src/app/api/stories/[id]/characters/[characterId]/show-chat/route.ts
//
// "Show this character": a short chat that agrees with the customer how and
// where a not-shown character (an unborn baby, a grandparent who has died, a
// pet that is only talked about) should appear in the pictures. When they
// agree, Claude calls save_how_to_show and we store the note on
// story_characters.appearance_note (and the look on the character, for its
// card). The client then makes the card and calls ../visibility to show
// them, which re-plans the scenes. Nothing is drawn by this route.
//
// Body: { messages: { role: "user" | "assistant", content: string }[] }
// Reply: { reply: string, saved?: { howToShow: string, appearance: string | null } }

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { characters, stories, storyCharacters, storyPages } from "@/db/schema";
import { withAccess } from "@/lib/authz";
import { withAlerts } from "@/lib/alerts";
import { trackedAnthropic } from "@/lib/ai/anthropicUsage";
import { setAppearanceNote } from "@/lib/characters/visibility";

export const maxDuration = 30;

const client = trackedAnthropic("app/api/stories/[id]/characters/[characterId]/show-chat/route", { apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 12;

const SAVE_TOOL = {
  name: "save_how_to_show",
  description: "Save how this character should appear in the book's pictures. Call only after the customer has agreed to a specific plan.",
  input_schema: {
    type: "object" as const,
    properties: {
      how_to_show: {
        type: "string",
        description:
          "One or two plain sentences for the illustrator: what the character looks like in the pictures and on which pages, e.g. \"Little One appears only on the last spread, as a sleeping newborn in Mama Sifin's arms, wrapped in a yellow blanket.\" Use names.",
      },
      appearance: {
        type: "string",
        description: "What the character looks like, for drawing their character card (age, hair, skin, clothes). Leave empty if the story already describes them well.",
      },
    },
    required: ["how_to_show"],
  },
};

type Msg = { role: "user" | "assistant"; content: string };

function cleanMessages(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TURNS) return null;
  const out: Msg[] = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.trim().slice(0, 1500);
    if (content) out.push({ role: m.role, content });
  }
  // Claude needs the conversation to start and end with the customer.
  while (out.length && out[0].role !== "user") out.shift();
  return out.length && out[out.length - 1].role === "user" ? out : null;
}

async function _POST(req: Request, context: { params: Promise<{ id: string; characterId: string }> }) {
  const { id: storyId, characterId } = await context.params;
  const body = await req.json().catch(() => null);
  const messages = cleanMessages(body?.messages);
  if (!messages) return NextResponse.json({ error: "Please type a message." }, { status: 400 });

  const [cast] = await db
    .select({
      name: characters.name,
      description: characters.description,
      appearance: characters.appearance,
      note: storyCharacters.appearanceNote,
    })
    .from(storyCharacters)
    .innerJoin(characters, eq(characters.id, storyCharacters.characterId))
    .where(and(eq(storyCharacters.storyId, storyId), eq(storyCharacters.characterId, characterId)))
    .limit(1);
  if (!cast) return NextResponse.json({ error: "That character isn't in this book." }, { status: 404 });

  const [story] = await db.select({ title: stories.title }).from(stories).where(eq(stories.id, storyId)).limit(1);
  const pages = await db
    .select({ n: storyPages.pageNumber, text: storyPages.text })
    .from(storyPages)
    .where(eq(storyPages.storyId, storyId))
    .orderBy(asc(storyPages.pageNumber));
  const storyText = pages.map((p) => `Page ${p.n}: ${p.text}`).join("\n").slice(0, 12000);

  const system = `You help a parent decide how ${cast.name} should appear in the pictures of their personalised picture book "${story?.title ?? "their book"}".

Right now ${cast.name} is in the story but is not drawn in any picture${cast.description ? ` (${cast.description})` : ""}.${cast.appearance ? ` What we know about how they look: ${cast.appearance}.` : ""}${cast.note ? ` Earlier idea: ${cast.note}.` : ""}

THE STORY
${storyText || "(no pages yet)"}

HOW TO HELP
- Keep it short and warm: one or two sentences, and at most one question per reply. No lists. British English.
- Work out together: how ${cast.name} should look in the pictures, and on which pages or moments they appear. Offer one or two concrete ideas that fit the story (for an unborn baby, for example: shown as a newborn on the final page, a scan photo on the fridge, or just Mama's bump). Let them choose.
- They may want ${cast.name} in many pictures or only one. Both are fine.
- Be gentle if the character is someone who has died or is missed.
- As soon as the parent agrees to a specific plan, call save_how_to_show and then say in one sentence what will happen next: we'll make ${cast.name}'s picture for them to approve, then the pages that include ${cast.name} are planned again.
- Never promise anything about payment, delivery dates or prices.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    tools: [SAVE_TOOL],
    messages,
  });

  const reply = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const call = response.content.find((b) => b.type === "tool_use" && (b as { name: string }).name === SAVE_TOOL.name) as
    | { input: { how_to_show?: string; appearance?: string } }
    | undefined;

  if (call?.input?.how_to_show?.trim()) {
    const howToShow = call.input.how_to_show.trim().slice(0, 1000);
    const appearance = call.input.appearance?.trim() ? call.input.appearance.trim().slice(0, 1000) : null;
    await setAppearanceNote(storyId, characterId, howToShow);
    if (appearance) {
      await db.update(characters).set({ appearance, updatedAt: new Date() }).where(eq(characters.id, characterId));
    }
    return NextResponse.json({
      reply: reply || `Lovely. I'll make ${cast.name}'s picture now for you to approve, then plan the pages again with ${cast.name} in them.`,
      saved: { howToShow, appearance },
    });
  }

  return NextResponse.json({ reply: reply || "Could you tell me a little more about how you'd like them to appear?" });
}

export const POST = withAlerts("api/stories/characters/show-chat", withAccess({ story: { param: "id" } }, _POST));

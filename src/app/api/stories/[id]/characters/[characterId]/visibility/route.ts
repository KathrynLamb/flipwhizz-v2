// src/app/api/stories/[id]/characters/[characterId]/visibility/route.ts
//
// Show or hide one character in this book's pictures (customer or admin).
// Body: { shown: boolean, note?: string | null }
//
// Hiding takes them off every planned spread straight away, so they stop
// needing a card. Either way, if the scenes are already planned they are
// re-planned so every brief knows; showing also redraws finished pictures
// that now include the character, once they have a card
// (src/lib/characters/visibility.ts).

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { characters, storyCharacters, storyWorkflowProgress } from "@/db/schema";
import { getAuthUser, withAccess } from "@/lib/authz";
import { bookBusy } from "@/lib/admin/server";
import { replanScenes, setCharacterShown } from "@/lib/characters/visibility";
import { recordBookEventSoon } from "@/lib/events/bookEvents";

async function _POST(req: Request, context: { params: Promise<{ id: string; characterId: string }> }) {
  const { id: storyId, characterId } = await context.params;
  const body = await req.json().catch(() => null);
  if (typeof body?.shown !== "boolean") return NextResponse.json({ error: "Say whether to show or hide this character." }, { status: 400 });
  const note = body.note === undefined ? undefined : typeof body.note === "string" ? body.note : null;

  const [row] = await db
    .select({ name: characters.name })
    .from(storyCharacters)
    .innerJoin(characters, eq(characters.id, storyCharacters.characterId))
    .where(and(eq(storyCharacters.storyId, storyId), eq(storyCharacters.characterId, characterId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "That character isn't in this book." }, { status: 404 });

  // Re-planning while pictures are being drawn would change briefs under a running job.
  const busy = await bookBusy(storyId).catch(() => null);
  if (busy?.busy) {
    return NextResponse.json({ error: "Your book is drawing right now. Try again when it has finished." }, { status: 409 });
  }

  const user = await getAuthUser();
  const source = user?.isAdmin ? "admin" : "customer";
  const done = await setCharacterShown({ storyId, characterId, shown: body.shown, source, note });
  if (!done.ok) return NextResponse.json({ error: "Could not save that. Please try again." }, { status: 500 });

  const [progress] = await db
    .select({ planned: storyWorkflowProgress.scenesDecided })
    .from(storyWorkflowProgress)
    .where(eq(storyWorkflowProgress.storyId, storyId))
    .limit(1);
  const replanning = Boolean(progress?.planned);
  if (replanning) {
    await replanScenes(storyId, {
      redrawForCharacterId: body.shown ? characterId : null,
      reason: `${row.name} ${body.shown ? "shown" : "hidden"} by ${source}`,
    });
  }

  if (source === "customer") {
    recordBookEventSoon({
      kind: body.shown ? "character_shown" : "character_hidden",
      summary: body.shown
        ? `Asked for ${row.name} to be in the pictures${note ? `: ${note}` : ""}`
        : `Took ${row.name} out of the pictures`,
      storyId,
      userId: user?.id ?? null,
      details: { character: row.name, note: note ?? null },
    });
  }

  return NextResponse.json({ ok: true, shown: body.shown, replanning });
}

export const POST = withAccess({ story: { param: "id" } }, _POST);

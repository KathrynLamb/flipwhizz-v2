// api-world-promote.ts
// Drop into: src/app/api/worlds/[worldId]/promote/route.ts
// Handles promoting story-level characters/locations to world-level

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  worlds,
  worldCharacters,
  worldLocations,
} from "@/db/schema-worlds";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const promoteSchema = z.object({
  type: z.enum(["character", "location"]),
  entityId: z.string().uuid(), // characterId or locationId
  isRecurring: z.boolean().optional().default(true),
  characterArc: z.string().optional(), // only for characters
  notes: z.string().optional(),
  firstAppearanceStoryId: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { worldId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify world ownership
  const world = await db.query.worlds.findFirst({
    where: and(
      eq(worlds.id, params.worldId),
      eq(worlds.userId, session.user.id)
    ),
  });

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = promoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, entityId, isRecurring, characterArc, notes, firstAppearanceStoryId } =
    parsed.data;

  if (type === "character") {
    // Check for existing
    const existing = await db.query.worldCharacters.findFirst({
      where: and(
        eq(worldCharacters.worldId, params.worldId),
        eq(worldCharacters.characterId, entityId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: "Character already in this world" },
        { status: 409 }
      );
    }

    // Get current max sort order
    const maxSort = await db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort
       FROM world_characters WHERE world_id = $1`,
      [params.worldId]
    );

    const [worldChar] = await db
      .insert(worldCharacters)
      .values({
        worldId: params.worldId,
        characterId: entityId,
        isRecurring,
        characterArc,
        notes,
        firstAppearanceStoryId,
        sortOrder: Number(maxSort.rows?.[0]?.next_sort ?? 0),
      })
      .returning();

    return NextResponse.json(worldChar, { status: 201 });
  }

  if (type === "location") {
    const existing = await db.query.worldLocations.findFirst({
      where: and(
        eq(worldLocations.worldId, params.worldId),
        eq(worldLocations.locationId, entityId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: "Location already in this world" },
        { status: 409 }
      );
    }

    const maxSort = await db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort
       FROM world_locations WHERE world_id = $1`,
      [params.worldId]
    );

    const [worldLoc] = await db
      .insert(worldLocations)
      .values({
        worldId: params.worldId,
        locationId: entityId,
        isRecurring,
        notes,
        firstAppearanceStoryId,
        sortOrder: Number(maxSort.rows?.[0]?.next_sort ?? 0),
      })
      .returning();

    return NextResponse.json(worldLoc, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
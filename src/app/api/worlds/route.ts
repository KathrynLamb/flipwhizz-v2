// api-worlds.ts
// Drop into: src/app/api/worlds/route.ts
// Handles GET (list), POST (create) for worlds

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  worlds,
  worldReaders,
  worldCharacters,
  worldLocations,
  worldNarrativeMemory,
} from "@/db/schema-worlds";
import { eq, desc, and, sql } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const createWorldSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  readerId: z.string().uuid(),
  readerRole: z.string().max(100).optional(),
  tonality: z.string().max(100).optional(),
  ageRange: z.string().max(50).optional(),
  themes: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all worlds with reader count and book count
  const userWorlds = await db
    .select({
      id: worlds.id,
      name: worlds.name,
      description: worlds.description,
      tonality: worlds.tonality,
      ageRange: worlds.ageRange,
      themes: worlds.themes,
      coverImageUrl: worlds.coverImageUrl,
      createdAt: worlds.createdAt,
      updatedAt: worlds.updatedAt,
    })
    .from(worlds)
    .where(eq(worlds.userId, session.user.id))
    .orderBy(desc(worlds.updatedAt));

  // For each world, get reader names and book count
  const worldsWithDetails = await Promise.all(
    userWorlds.map(async (world) => {
      const readers = await db
        .select({
          readerId: worldReaders.readerId,
          role: worldReaders.role,
        })
        .from(worldReaders)
        .where(eq(worldReaders.worldId, world.id));

      // Count stories in this world
      // Adjust to use your actual stories table reference
      const bookCount = await db.execute(
        sql`SELECT COUNT(*) as count FROM stories WHERE world_id = ${world.id}`
      );

      const characterCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(worldCharacters)
        .where(eq(worldCharacters.worldId, world.id));

      return {
        ...world,
        readerCount: readers.length,
        bookCount: Number(bookCount.rows?.[0]?.count ?? 0),
        characterCount: Number(characterCount[0]?.count ?? 0),
      };
    })
  );

  return NextResponse.json(worldsWithDetails);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createWorldSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Create world + link reader in a transaction
  const result = await db.transaction(async (tx) => {
    const [world] = await tx
      .insert(worlds)
      .values({
        userId: session.user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        tonality: parsed.data.tonality,
        ageRange: parsed.data.ageRange,
        themes: parsed.data.themes ?? [],
      })
      .returning();

    // Link the primary reader
    await tx.insert(worldReaders).values({
      worldId: world.id,
      readerId: parsed.data.readerId,
      role: parsed.data.readerRole ?? "protagonist",
    });

    return world;
  });

  return NextResponse.json(result, { status: 201 });
}
// src/app/api/worlds/[worldId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { readers } from "@/db/schema";
import { worlds, worldReaders } from "@/db/schema-worlds";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the world
  const world = await db
    .select()
    .from(worlds)
    .where(and(eq(worlds.id, worldId), eq(worlds.userId, session.user.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  // Get readers linked to this world
  const links = await db
    .select({
      role: worldReaders.role,
      readerId: worldReaders.readerId,
    })
    .from(worldReaders)
    .where(eq(worldReaders.worldId, worldId));

  // Fetch reader details for each link
  const worldReadersList = await Promise.all(
    links.map(async (link) => {
      const reader = await db
        .select({
          id: readers.id,
          name: readers.name,
          gender: readers.gender,
        })
        .from(readers)
        .where(eq(readers.id, link.readerId))
        .limit(1)
        .then((rows) => rows[0]);

      return {
        role: link.role,
        reader: reader ?? null,
      };
    })
  );

  return NextResponse.json({
    ...world,
    readers: worldReadersList.filter((r) => r.reader !== null),
  });
}
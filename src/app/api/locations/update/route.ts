// src/app/api/locations/update/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locationId, description } = await req.json();

  if (!locationId) {
    return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
  }

  const [location] = await db
    .select({
      id: locations.id,
      userId: locations.userId,
      locked: locations.locked,
      description: locations.description,
    })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  if (location.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Add a description for this location.' }, { status: 400 });
  }

  await db
    .update(locations)
    .set({
      description: description.trim(),
      ...(description.trim() !== location.description ? { portraitImageUrl: null } : {}),
      locked: false, lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(locations.id, locationId));

  return NextResponse.json({ ok: true });
}

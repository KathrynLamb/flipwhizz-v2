// src/app/api/locations/lock/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPortrait } from "@/lib/characters/readiness";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locationId, portraitImageUrl } = await req.json();
  if (!locationId) {
    return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
  }

  const [location] = await db
    .select({
      id: locations.id,
      userId: locations.userId,
      locked: locations.locked,
      portraitImageUrl: locations.portraitImageUrl,
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

  if (!hasPortrait(location)) {
    return NextResponse.json({ error: 'Generate an scene and review it before approving.' }, { status: 409 });
  }
  if (portraitImageUrl && portraitImageUrl !== location.portraitImageUrl) {
    return NextResponse.json({ error: 'The scene changed. Refresh and review the latest image.' }, { status: 409 });
  }

  const approved = await db
    .update(locations)
    .set({ locked: true, lockedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.portraitImageUrl, location.portraitImageUrl!)))
    .returning({ id: locations.id });
  if (!approved.length) return NextResponse.json({ error: "Scene changed. Please review it again." }, { status: 409 });

  return NextResponse.json({ ok: true });
}
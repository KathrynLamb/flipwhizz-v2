// src/app/api/locations/lock/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateLocationPortraitFromDescription } from "@/lib/locations/generateLocationPortrait";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locationId } = await req.json();
  if (!locationId) {
    return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
  }

  const [location] = await db
    .select({
      id: locations.id,
      userId: locations.userId,
      locked: locations.locked,
      portraitImageUrl: locations.portraitImageUrl,
      referenceImageUrl: locations.referenceImageUrl,
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

  const newLocked = !location.locked;

  // When locking: auto-generate a portrait if none exists
  // (reference image takes priority — only generate from description if both are missing)
  if (newLocked && !location.portraitImageUrl && !location.referenceImageUrl) {
    try {
      console.log(
        `🏞️ No portrait for location ${locationId} — auto-generating from description`
      );
      await generateLocationPortraitFromDescription(locationId);
      console.log(`✅ Auto-generated portrait for location ${locationId}`);
    } catch (err) {
      // Log but don't block the lock — illustrator will handle missing location refs gracefully
      console.error(
        `⚠️ Failed to auto-generate portrait for location ${locationId}:`,
        err
      );
    }
  }

  await db
    .update(locations)
    .set({
      locked: newLocked,
      lockedAt: newLocked ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(locations.id, locationId));

  return NextResponse.json({ ok: true, locked: newLocked });
}
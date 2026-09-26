import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireLocationOwner } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const { locationId } = await req.json();
    const ownerCheck = await requireLocationOwner(locationId);
    if (!ownerCheck.ok) return ownerCheck.response;

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    await db
      .update(locations)
      .set({ locked: false, lockedAt: null })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unlock location:", error);
    return NextResponse.json(
      { error: "Failed to unlock location" },
      { status: 500 }
    );
  }
}
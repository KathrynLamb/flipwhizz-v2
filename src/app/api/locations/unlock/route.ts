import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";

export async function POST(req: Request) {
  try {
    const { locationId } = await req.json();

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
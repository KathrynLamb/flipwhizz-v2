// src/app/api/locations/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ unwrap params correctly (Next.js App Router requirement)
    const { id: locationId } = await context.params;

    const body = await request.json();

    const update: Record<string, any> = {};

    if (body.description !== undefined) {
      update.description = body.description;
    }

    if (body.referenceImageUrl !== undefined) {
      update.referenceImageUrl = body.referenceImageUrl;
    }

    // No-op save (safe for autosave flows)
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true });
    }

    await db
      .update(locations)
      .set(update)
      .where(eq(locations.id, locationId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[LOCATION PATCH ERROR]", err);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

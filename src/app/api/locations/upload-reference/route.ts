import { NextResponse } from "next/server";
// import { db } from "@/lib/db";
// import { locations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { withAccess } from "@/lib/authz";

async function _POST(req: Request) {
  try {
    const { locationId, imageUrl } = await req.json();

    if (!locationId || !imageUrl) {
      return NextResponse.json(
        { error: "locationId and imageUrl are required" },
        { status: 400 }
      );
    }

    await db
      .update(locations)
      .set({
        referenceImageUrl: imageUrl,
        portraitImageUrl: null, locked: false, lockedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("LOCATION UPLOAD ERROR:", error);
    return NextResponse.json(
      { error: "Failed to save reference image" },
      { status: 500 }
    );
  }
}

export const POST = withAccess({ location: { body: "locationId" } }, _POST);

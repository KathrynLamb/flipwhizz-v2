import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

type GenerateSpreadRequestBody = {
  leftPageId?: string;
  rightPageId?: string | null;
  pageLabel?: string;
  feedback?: string;
  existingSpreadImageUrl?: string | null;
  freshStart?: boolean;
  referenceOverrides?: {
    includedCharacterIds: string[];
    outfitOverrides: Record<string, string>;
    locationId: string | null;
  };
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const body = (await req.json()) as GenerateSpreadRequestBody;

    const {
      leftPageId,
      rightPageId,
      pageLabel,
      feedback,
      existingSpreadImageUrl,
      freshStart,
      referenceOverrides,
    } = body;

    if (!leftPageId || !pageLabel) {
      return NextResponse.json(
        { error: "leftPageId and pageLabel are required" },
        { status: 400 }
      );
    }

    // Basic validation for redraw override payload shape
    if (referenceOverrides) {
      const includedCharacterIdsValid = Array.isArray(
        referenceOverrides.includedCharacterIds
      );
      const outfitOverridesValid =
        referenceOverrides.outfitOverrides &&
        typeof referenceOverrides.outfitOverrides === "object" &&
        !Array.isArray(referenceOverrides.outfitOverrides);
      const locationIdValid =
        referenceOverrides.locationId === null ||
        typeof referenceOverrides.locationId === "string";

      if (
        !includedCharacterIdsValid ||
        !outfitOverridesValid ||
        !locationIdValid
      ) {
        return NextResponse.json(
          {
            error:
              "referenceOverrides must include includedCharacterIds[], outfitOverrides{}, and locationId",
          },
          { status: 400 }
        );
      }
    }

    // ── Check style guide status so client can warn user ──────────────────
    const styleRows = await db
      .select({
        approved: storyStyleGuide.approved,
        hasSampleImage: storyStyleGuide.sampleIllustrationUrl,
        hasPromptBase: storyStyleGuide.userNotes,
      })
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId))
      .limit(1);

    const style = styleRows[0];
    const styleWarning = !style
      ? "no_style_guide"
      : !style.approved
        ? "style_not_locked"
        : !style.hasSampleImage
          ? "no_reference_image"
          : null;

    // ── Clear existing imageUrl so poll reports "generating" not old image ─
    const pageIdsToClear = [leftPageId, rightPageId].filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );

    if (pageIdsToClear.length > 0) {
      await db
        .update(storyPages)
        .set({ imageUrl: null })
        .where(inArray(storyPages.id, pageIdsToClear));
    }

    // ── Fire Inngest — fields match GenerateSingleSpreadEventSchema exactly ─
    await inngest.send({
      name: "story/generate.single.spread",
      data: {
        storyId,
        leftPageId,
        rightPageId: rightPageId ?? null,
        pageLabel,
        feedback: feedback?.trim() ? feedback.trim() : undefined,
        existingSpreadImageUrl:
          freshStart || !existingSpreadImageUrl
            ? null
            : existingSpreadImageUrl,
        referenceOverrides: referenceOverrides
          ? {
              includedCharacterIds: referenceOverrides.includedCharacterIds,
              outfitOverrides: referenceOverrides.outfitOverrides,
              locationId: referenceOverrides.locationId,
            }
          : undefined,
      },
    });

    const jobId = `${leftPageId}__${storyId}`;

    return NextResponse.json({
      jobId,
      styleWarning,
    });
  } catch (error) {
    console.error("generate-spread route error:", error);
    return NextResponse.json(
      { error: "Failed to queue spread generation" },
      { status: 500 }
    );
  }
}
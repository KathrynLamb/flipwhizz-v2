import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storyPages,
  storyStyleGuide,
  storySpreads,
  storySpreadScene,
  storySpreadPresence,
  storyCharacters,
} from "@/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { v4 as uuid } from "uuid";

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
    primaryLocationId: string | null;
    includedLocationIds: string[];
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
      const primaryLocationIdValid =
        referenceOverrides.primaryLocationId === null ||
        typeof referenceOverrides.primaryLocationId === "string";
      const includedLocationIdsValid = Array.isArray(
        referenceOverrides.includedLocationIds
      );

      if (
        !includedCharacterIdsValid ||
        !outfitOverridesValid ||
        !primaryLocationIdValid ||
        !includedLocationIdsValid
      ) {
        return NextResponse.json(
          {
            error:
              "referenceOverrides must include includedCharacterIds[], outfitOverrides{}, primaryLocationId, and includedLocationIds[]",
          },
          { status: 400 }
        );
      }
    }

    /* ------------------------------------------------------------------ */
    /* PREFLIGHT: Verify scene record exists for this spread               */
    /* The preview route fires story/generate.single.spread directly,      */
    /* bypassing generateBookSpreads and its auto-recovery preflight.      */
    /* If scene records are missing we trigger build-spread-prompts and    */
    /* tell the client to retry in ~30s.                                   */
    /* ------------------------------------------------------------------ */

    const spread = await db
      .select({ id: storySpreads.id })
      .from(storySpreads)
      .where(
        rightPageId
          ? or(
              eq(storySpreads.leftPageId, leftPageId),
              eq(storySpreads.rightPageId, rightPageId)
            )
          : eq(storySpreads.leftPageId, leftPageId)
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (spread) {
      const sceneRecord = await db.query.storySpreadScene.findFirst({
        where: eq(storySpreadScene.spreadId, spread.id),
      });

      if (!sceneRecord) {
        console.warn(
          `⚠️ [generate-spread] No scene record for spread ${spread.id} — triggering build-spread-prompts for story ${storyId}`
        );

        await inngest.send({
          name: "story/build-spread-prompts",
          data: { storyId },
        });

        return NextResponse.json(
          {
            buildingPrompts: true,
            retryAfter: 35,
            message:
              "Building illustration prompts — please try again in 35 seconds.",
          },
          { status: 202 }
        );
      }

      /* ---------------------------------------------------------------- */
      /* PREFLIGHT: Verify presence rows have characters                   */
      /* If presence is empty, auto-populate from storyCharacters and      */
      /* re-trigger build-spread-prompts (same fix as buildSpreadPrompts). */
      /* ---------------------------------------------------------------- */

      const presenceRow = await db.query.storySpreadPresence.findFirst({
        where: eq(storySpreadPresence.spreadId, spread.id),
      });

      const presenceChars = (presenceRow?.characters ?? []) as Array<{
        characterId: string;
        role: string;
      }>;

      if (presenceChars.length === 0) {
        console.warn(
          `⚠️ [generate-spread] Presence empty for spread ${spread.id} — auto-populating and rebuilding prompts`
        );

        // Auto-populate presence with all story characters as primary
        const storyCharRows = await db.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
        });

        if (storyCharRows.length > 0) {
          const defaultCharacters = storyCharRows.map((sc, i) => ({
            characterId: sc.characterId,
            role: i < 3 ? "primary" : "background",
          }));

          await db
            .insert(storySpreadPresence)
            .values({
              id: uuid(),
              spreadId: spread.id,
              characters: defaultCharacters,
              locations: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: storySpreadPresence.spreadId,
              set: {
                characters: defaultCharacters,
                updatedAt: new Date(),
              },
            });
        }

        // Delete stale scene record so build-spread-prompts rewrites it with character context
        await db
          .delete(storySpreadScene)
          .where(eq(storySpreadScene.spreadId, spread.id));

        await inngest.send({
          name: "story/build-spread-prompts",
          data: { storyId },
        });

        return NextResponse.json(
          {
            buildingPrompts: true,
            retryAfter: 35,
            message:
              "Rebuilding illustration prompts — please try again in 35 seconds.",
          },
          { status: 202 }
        );
      }
    }

    /* ------------------------------------------------------------------ */
    /* STYLE GUIDE STATUS — client warning only                           */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /* Clear existing imageUrl so poll reports "generating" not old image  */
    /* ------------------------------------------------------------------ */

    const pageIdsToClear = [leftPageId, rightPageId].filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );

    if (pageIdsToClear.length > 0) {
      await db
        .update(storyPages)
        .set({ imageUrl: null })
        .where(inArray(storyPages.id, pageIdsToClear));
    }

    /* ------------------------------------------------------------------ */
    /* Fire Inngest                                                        */
    /* ------------------------------------------------------------------ */

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
              primaryLocationId: referenceOverrides.primaryLocationId,
              includedLocationIds: referenceOverrides.includedLocationIds,
            }
          : undefined,
      },
    });

    const jobId = `${leftPageId}__${storyId}`;

    return NextResponse.json({ jobId, styleWarning });
  } catch (error) {
    console.error("generate-spread route error:", error);
    return NextResponse.json(
      { error: "Failed to queue spread generation" },
      { status: 500 }
    );
  }
}
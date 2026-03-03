// src/app/stories/[id]/characters/page.tsx
import { notFound } from "next/navigation";
import { getStoryForHub } from "@/lib/story/getStoryForHub";
import { db } from "@/db";
import { storyWorkflowProgress, characterStoryOutfits } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import CharactersClient from "@/app/stories/[id]/characters/CharactersClient";
import { StepKey } from "@/lib/storySteps";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CharactersPage({ params }: Props) {
  const { id: storyId } = await params;

  const data = await getStoryForHub(storyId);
  if (!data) notFound();

  const { story, characters: dbCharacters } = data;

  // ✅ Check workflow progress
  const progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  // ⏳ Extraction still running → show loading state
  if (!progress || !progress.worldComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Preparing your characters…</p>
      </div>
    );
  }

  // ✅ Fetch all outfits for this story in one query
  const allOutfits = await db
    .select()
    .from(characterStoryOutfits)
    .where(eq(characterStoryOutfits.storyId, storyId));

  // Group outfits by characterId
  const outfitsByCharacter = new Map<string, typeof allOutfits>();
  for (const outfit of allOutfits) {
    const existing = outfitsByCharacter.get(outfit.characterId) || [];
    existing.push(outfit);
    outfitsByCharacter.set(outfit.characterId, existing);
  }

  const characters = dbCharacters.map((char) => ({
    id: char.id,
    name: char.name,
    description: char.description ?? null,
    appearance: char.appearance ?? null,
    personalityTraits: char.personalityTraits ?? null,
    referenceImageUrl: char.referenceImageUrl ?? null,
    portraitImageUrl: char.portraitImageUrl ?? null,
    locked: char.locked,
    visualDetails: (char.visualDetails as Record<string, any>) ?? null,
    outfits: (outfitsByCharacter.get(char.id) || []).map((o) => ({
      id: o.id,
      outfitKey: o.outfitKey,
      outfitDescription: o.outfitDescription,
      triggerConditions: o.triggerConditions ?? null,
    })),
  }));

  return (
    <CharactersClient
    storyId={storyId}
    storyTitle={story.title}
    storyConfirmed={story.storyConfirmed === true}
    characters={characters}
    currentStep="characters"
    completedSteps={(story.completedSteps as StepKey[]) || []}
  />
  );
}
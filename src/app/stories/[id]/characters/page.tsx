// src/app/stories/[id]/characters/page.tsx
import { notFound } from "next/navigation";
import { getStoryForHub } from "@/lib/story/getStoryForHub";
import { db } from "@/db";
import { storyWorkflowProgress } from "@/db/schema";
import { eq } from "drizzle-orm";
import CharactersClient from "./CharactersClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CharactersPage({ params }: Props) {
  const { id: storyId } = await params;

  const data = await getStoryForHub(storyId);
  if (!data) notFound();

  const { story, characters: dbCharacters } = data;

  // ✅ Check workflow progress instead of redirecting to hub
  const progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  // ⏳ Extraction still running → show loading state IN characters
  if (!progress || !progress.worldExtracted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Preparing your characters…</p>
      </div>
    );
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
  }));

  return (
    <CharactersClient
      storyId={storyId}
      storyConfirmed={story.storyConfirmed === true}
      characters={characters}
    />
  );
}

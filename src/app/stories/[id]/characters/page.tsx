// src/app/stories/[id]/characters/page.tsx
import { notFound, redirect } from "next/navigation";
import { getStoryForHub } from "@/lib/story/getStoryForHub";
import CharactersClient from "@/app/stories/[id]/characters/CharactersClient";


type Props = {
  params: Promise<{ id: string }>;
};

export default async function CharactersPage({ params }: Props) {
  const { id: storyId } = await params;

  const data = await getStoryForHub(storyId);
  if (!data) notFound();

const { story, characters: dbCharacters } = data;

const characters = dbCharacters.map(c => ({
  ...c,
  locked: story.storyConfirmed === true,
}));


  // Guard: no characters yet → extraction not run
  if (characters.length === 0) {
    redirect(`/stories/${storyId}/hub`);
  }

  return (
    <CharactersClient
      storyId={storyId}
      storyConfirmed={story.storyConfirmed === true}
      characters={characters}
    />
  );
}

// src/app/stories/[id]/characters/page.tsx
import { notFound, redirect } from "next/navigation";
import { getStoryForHub } from "@/lib/story/getStoryForHub";
import LocationsClient from "@/app/stories/[id]/locations/locationsClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LocationsPage({ params }: Props) {
  const { id: storyId } = await params;

  const data = await getStoryForHub(storyId);
  if (!data) notFound();
  const { story, locations: dbLocations } = data;

  console.log("DB LOCATIONS", dbLocations)

  const locations = dbLocations.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? null,
    referenceImageUrl: l.referenceImageUrl ?? null,
    portraitImageUrl: l.portraitImageUrl ?? null,
    locked: l.locked
    // locked: l.locked,
  }));
  

  // Guard: no characters yet → extraction not run
  if (locations.length === 0) {
    redirect(`/stories/${storyId}/hub`);
  }

  return (
<LocationsClient
  storyId={storyId}
  storyConfirmed={story.storyConfirmed === true}
  locations={locations}
/>

  );
}

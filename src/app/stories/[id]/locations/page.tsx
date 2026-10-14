import { isCastReady } from '@/lib/characters/readiness';
import { notFound, redirect } from "next/navigation";
import { getStoryForHub } from "@/lib/story/getStoryForHub";
import LocationsClient from "@/app/stories/[id]/locations/locationsClient";
import type { StepKey } from "@/lib/storySteps";
import { requireStoryOwnerPage } from "@/lib/pageGuards";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LocationsPage({ params }: Props) {
  const { id: storyId } = await params;
  // Check access before loading data. See src/lib/pageGuards.ts
  await requireStoryOwnerPage(storyId);

  const data = await getStoryForHub(storyId);
  if (!data) notFound();
  const { story, locations: dbLocations } = data;

  // Direct navigation must not bypass the same appearance review as the CTA.
  if (!isCastReady(data.characters)) redirect(`/stories/${storyId}/characters`);
  const completedSteps = (story.completedSteps as StepKey[]) || [];

  const currentStep: StepKey = "locations";

  const locations = dbLocations.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? null,
    referenceImageUrl: l.referenceImageUrl ?? null,
    portraitImageUrl: l.portraitImageUrl ?? null,
    locked: l.locked,
  }));

  // Guard: no locations yet → redirect to characters
  if (locations.length === 0) {
    redirect(`/stories/${storyId}/characters`);
  }

  return (
    <LocationsClient
      storyId={storyId}
      storyTitle={story.title}
      storyConfirmed={completedSteps.includes("locations")}
      locations={locations}
      bookType={story.bookType ?? "storybook"}
      currentStep={currentStep}
      completedSteps={completedSteps}
    />
  );
}
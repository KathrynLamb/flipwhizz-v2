import { notFound, redirect } from "next/navigation";
import { getStoryForHub } from "@/lib/story/getStoryForHub";
import LocationsClient from "@/app/stories/[id]/locations/locationsClient";
import { stepNumberToKey } from "@/lib/storySteps";
import type { StepKey } from "@/lib/storySteps";




type Props = {
  params: Promise<{ id: string }>;
};

export default async function LocationsPage({ params }: Props) {
  const { id: storyId } = await params;

  const data = await getStoryForHub(storyId);
  if (!data) notFound();
  const { story, locations: dbLocations } = data;

  const completedSteps = story.completedSteps as StepKey[];

  const currentStep: StepKey =
    story.currentStep != null
      ? stepNumberToKey(story.currentStep)
      : "extract"; // safe fallback
  

  
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
      currentStep={currentStep}
      completedSteps={completedSteps}
    />
  );
}
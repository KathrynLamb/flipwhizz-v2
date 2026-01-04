// app/stories/[id]/hub/page.tsx
import { notFound, redirect } from "next/navigation";
import { getStoryForHub } from "@/lib/story/getStoryForHub";
import { deriveHubState } from "@/lib/story/deriveHubState";
import StoryHubClient from "./StoryHubClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: "live" | "edit" }>;
};

export default async function StoryHubPage(props: PageProps) {
  // ✅ UNWRAP ASYNC PARAMS (THIS FIXES YOUR ERROR)
  const { id: storyId } = await props.params;
  const { mode = "live" } = await props.searchParams;

  if (!storyId) notFound();

  const data = await getStoryForHub(storyId);

  if (!data) notFound();

  const { 
    story, 
    pages, 
    characters,
    locations,
    styleGuide,
    product, } = data;
  // console.log("story", story, "pages", pages)
  console.log("character", characters)

  // Guard rail: hub makes no sense without pages
  if (pages.length === 0) {
    redirect(`/stories/${storyId}/edit-with-claude`);
  }

  const hub = deriveHubState(data);

  return (

  <StoryHubClient
    story={{
      id: story.id,
      title: story.title,
      updatedAt: story.updatedAt ?? story.createdAt ?? new Date(),
    }}
    hub={hub}
    mode={mode}
  />

  );
}

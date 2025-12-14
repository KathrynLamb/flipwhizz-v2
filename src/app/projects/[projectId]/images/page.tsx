import InitialStyleEditor, {
    Entity,
    StyleGuide as ClientStyleGuide,
  } from "@/components/InitialStyleEditor";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";
  import { notFound } from "next/navigation";
  
  export default async function ProjectImagesPage({
    params,
  }: {
    params: Promise<{ projectId: string }>;
  }) {
    // ✅ unwrap params (Next 15 dynamic)
    const { projectId } = await params;
    console.log(projectId)

  //   const story = await db
  //   .select()
  //   .from(stories)
  //   .where(eq(stories.id, storyId))
  //   .then((res) => res[0]);

  // if (!story) redirect("/");
  
// 1️⃣ Fetch Guide AND the Reference Images
const guide = await db.query.storyStyleGuide.findFirst({
  where: eq(storyStyleGuide.storyId, projectId),
  with: {
    // 👇 THIS IS THE KEY PART: Fetch the related images
    referenceImages: true, 
  },
});

console.log('guide', guide)

  // 2️⃣ Handle case where guide doesn't exist yet (create default object)
  const styleData = guide || {
    id: "new",
    storyId: projectId,
    summary: "",
    negativePrompt: "",
    sampleIllustrationUrl: null,
    referenceImages: [], // Empty array if no guide found
  };


  console.log('sytle data', styleData)

  
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/story`, {
      cache: "no-store",
    });
  
    if (!res.ok) return notFound();
  
    const { story, pages, characters, locations, style } = await res.json();
    console.log("STPRY ++++>>>", story)
  
    // console.log("Story bundle =>", { story, pages, characters, locations, style });
  
    // --- Normalise into the shapes InitialStyleEditor expects ---------
  
    // const pageTexts: string[] = (pages ?? []).map((p: any) => p.text ?? "");

    // const sampleStoryContext = pages.slice(0, 2).map(p => p.text);

  const leftText = pages[0].text
  const rightText = pages[1].text

  
    const characterEntities: Entity[] = (characters ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      referenceImageUrl: c.referenceImageUrl ?? null,
      description: c.description
    }));
  
    const locationEntities: Entity[] = (locations ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      // locations table doesn’t have a referenceImageUrl column yet,
      // so this will usually be null – that’s fine.
      referenceImageUrl: l.referenceImageUrl ?? null,
    }));
  
    const clientStyle: ClientStyleGuide = {
      id: style?.id ?? story.id,              // 👈 treat as STORY id for the API route
      storyId: style?.storyId ?? story.id,
      summary: style?.summary ?? null,
      negativePrompt: style?.negativePrompt ?? null,
      sampleIllustrationUrl: style?.sampleIllustrationUrl ?? null,
      referenceImages: style?.referenceImages ?? [], // will be enriched later
    };
  
    // --- UI -----------------------------------------------------------
  
    return (
      <main className="min-h-screen bg-[#0b0b10] text-white p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-semibold mb-6">Illustrations</h1>
  
          <p className="mb-6 text-sm text-white/70">
            Great – now that you’ve written your story, let’s get cracking on
            illustrations. What do you have in mind for this book – what kind of
            vibe are you looking for?
          </p>
  
          <InitialStyleEditor
            style={clientStyle}
            leftText={leftText}
            rightText={rightText}
            pages={pages}
            characters={characterEntities}
            locations={locationEntities}
          />
        </div>
      </main>
    );
  }
  
import CoverDesignWrapper from "@/app/stories/[id]/cover/CoverDesignWrapper";
import { stories } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) {
    throw new Error("Story not found");
  }

  return (
    <CoverDesignWrapper
      storyId={story.id}
      projectId={story.projectId}
      story={story}
    />
  );
}

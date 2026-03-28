// src/app/stories/[id]/hub/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNextStepHref } from "@/lib/storySteps";

export default async function HubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) redirect("/projects");

  const href = getNextStepHref(id, story);
  redirect(href);
}
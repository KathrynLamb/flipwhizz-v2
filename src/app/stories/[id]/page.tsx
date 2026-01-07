// src/app/stories/[id]/page.tsx
import { redirect } from "next/navigation";

export default async function StoryIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/stories/${id}/hub`);
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ worldId?: string; bookNumber?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const params = await searchParams;

  // Create the project
  const [project] = await db
    .insert(projects)
    .values({
      userId: session.user.id,
      name: "New Story",
    })
    .returning();

  // Build redirect URL — carry worldId and bookNumber through to chat
  const chatParams = new URLSearchParams({ project: project.id });
  if (params.worldId) chatParams.set("worldId", params.worldId);
  if (params.bookNumber) chatParams.set("bookNumber", params.bookNumber);

  redirect(`/chat?${chatParams.toString()}`);
}
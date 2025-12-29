// src/app/stories/[id]/checkout/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { stories, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import OrderFlow from "@/components/OrderFlow";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storyId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  const userId = session.user.id;

  // 👉 Fetch story
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) redirect("/dashboard");

  // 👉 Fetch project to verify ownership
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, story.projectId),
  });

  if (!project || project.userId !== userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* ... rest unchanged ... */}
        <OrderFlow storyId={storyId} userId={userId} />
      </div>
    </div>
  );
}

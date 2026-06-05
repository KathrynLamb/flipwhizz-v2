// src/app/api/admin/users/[userId]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { users, projects, stories, storyPages, storyWorkflowProgress } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function isAdmin(email: string | null | undefined) {
  return ADMIN_EMAIL && email === ADMIN_EMAIL;
}

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = params;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.createdAt));

  const userStories = await db
    .select({
      id: stories.id,
      projectId: stories.projectId,
      title: stories.title,
      status: stories.status,
      currentStep: stories.currentStep,
      storyConfirmed: stories.storyConfirmed,
      createdAt: stories.createdAt,
      updatedAt: stories.updatedAt,
      pageCount: sql<number>`cast(count(${storyPages.id}) as int)`,
      imagesCount: sql<number>`cast(sum(case when ${storyPages.imageUrl} is not null then 1 else 0 end) as int)`,
      charactersExtracted: storyWorkflowProgress.charactersExtracted,
      locationsExtracted: storyWorkflowProgress.locationsExtracted,
      spreadsBuilt: storyWorkflowProgress.spreadsBuilt,
      promptsBuilt: storyWorkflowProgress.promptsBuilt,
      worldComplete: storyWorkflowProgress.worldComplete,
    })
    .from(stories)
    .leftJoin(storyPages, eq(storyPages.storyId, stories.id))
    .leftJoin(storyWorkflowProgress, eq(storyWorkflowProgress.storyId, stories.id))
    .where(
      sql`${stories.projectId} IN (SELECT id FROM projects WHERE user_id = ${userId})`
    )
    .groupBy(
      stories.id,
      stories.projectId,
      stories.title,
      stories.status,
      stories.currentStep,
      stories.storyConfirmed,
      stories.createdAt,
      stories.updatedAt,
      storyWorkflowProgress.charactersExtracted,
      storyWorkflowProgress.locationsExtracted,
      storyWorkflowProgress.spreadsBuilt,
      storyWorkflowProgress.promptsBuilt,
      storyWorkflowProgress.worldComplete,
    )
    .orderBy(asc(stories.createdAt));

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    projects: userProjects,
    stories: userStories,
  });
}
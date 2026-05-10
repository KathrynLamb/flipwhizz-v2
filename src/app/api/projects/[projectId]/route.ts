// src/app/api/projects/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, chatSessions, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  // Verify ownership
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Safety check — refuse to delete projects that have stories
  const { sql } = await import("drizzle-orm");
  const [{ count }] = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM stories WHERE project_id = ${projectId}`
  ) as any;

  if (Number(count) > 0) {
    return NextResponse.json(
      { error: "Cannot delete a project that has stories" },
      { status: 400 }
    );
  }

  // Delete cascade: messages → sessions → project
  const sessions = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(eq(chatSessions.projectId, projectId));

  for (const s of sessions) {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, s.id));
  }

  await db.delete(chatSessions).where(eq(chatSessions.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));

  return NextResponse.json({ ok: true });
}
// src/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { users, projects, stories } from "@/db/schema";
import { eq, ilike, or, count, sql } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function isAdmin(email: string | null | undefined) {
  return ADMIN_EMAIL && email === ADMIN_EMAIL;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      projectCount: sql<number>`cast(count(distinct ${projects.id}) as int)`,
      storyCount: sql<number>`cast(count(distinct ${stories.id}) as int)`,
    })
    .from(users)
    .leftJoin(projects, eq(projects.userId, users.id))
    .leftJoin(stories, eq(stories.projectId, projects.id))
    .where(
      or(
        ilike(users.email, `%${q}%`),
        ilike(users.name, `%${q}%`)
      )
    )
    .groupBy(users.id, users.name, users.email, users.createdAt)
    .limit(20);

  return NextResponse.json({ users: results });
}
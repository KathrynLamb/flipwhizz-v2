import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" });

  const data = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session.user.id));

  return NextResponse.json({ projects: data });
}

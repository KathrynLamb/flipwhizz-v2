import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const data = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, auth.userId));

  return NextResponse.json({ projects: data });
}

// src/lib/apiAuth.ts
//
// Shared auth + ownership guards for API routes.
//
// Usage:
//   const auth = await requireStoryOwner(storyId);
//   if (!auth.ok) return auth.response;
//   // auth.userId is the signed-in user
//
// The admin (ADMIN_EMAIL) passes every ownership check so admin tooling
// can act on any user's content.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import {
  stories,
  projects,
  characters,
  locations,
  readers,
  orders,
} from "@/db/schema";

export type AuthResult =
  | { ok: true; userId: string; email: string | null; isAdmin: boolean }
  | { ok: false; response: NextResponse };

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function deny(status: 401 | 403 | 404, error: string): AuthResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/** Requires a signed-in user. */
export async function requireUser(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) return deny(401, "Unauthorized");

  const email = session?.user?.email ?? null;
  return {
    ok: true,
    userId,
    email,
    isAdmin: !!ADMIN_EMAIL && email === ADMIN_EMAIL,
  };
}

/** Requires the signed-in admin (ADMIN_EMAIL). */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isAdmin) return deny(403, "Forbidden");
  return auth;
}

/**
 * Shared tail for the owner checks: missing row → 404, someone else's → 403.
 * `ownerId` is undefined when the row doesn't exist.
 */
async function requireOwner(
  ownerId: string | null | undefined,
  exists: boolean,
  what: string
): Promise<AuthResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!exists) return deny(404, `${what} not found`);
  if (auth.isAdmin) return auth;
  if (!ownerId || ownerId !== auth.userId) return deny(403, "Forbidden");
  return auth;
}

export async function requireProjectOwner(
  projectId: string | null | undefined
): Promise<AuthResult> {
  if (!projectId) return deny(404, "Project not found");
  const [row] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return requireOwner(row?.userId, !!row, "Project");
}

export async function requireStoryOwner(
  storyId: string | null | undefined
): Promise<AuthResult> {
  if (!storyId) return deny(404, "Story not found");
  const [row] = await db
    .select({ userId: projects.userId })
    .from(stories)
    .innerJoin(projects, eq(stories.projectId, projects.id))
    .where(eq(stories.id, storyId))
    .limit(1);
  return requireOwner(row?.userId, !!row, "Story");
}

export async function requireCharacterOwner(
  characterId: string | null | undefined
): Promise<AuthResult> {
  if (!characterId) return deny(404, "Character not found");
  const [row] = await db
    .select({ userId: characters.userId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  return requireOwner(row?.userId, !!row, "Character");
}

export async function requireLocationOwner(
  locationId: string | null | undefined
): Promise<AuthResult> {
  if (!locationId) return deny(404, "Location not found");
  const [row] = await db
    .select({ userId: locations.userId })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  return requireOwner(row?.userId, !!row, "Location");
}

export async function requireReaderOwner(
  readerId: string | null | undefined
): Promise<AuthResult> {
  if (!readerId) return deny(404, "Reader not found");
  const [row] = await db
    .select({ userId: readers.userId })
    .from(readers)
    .where(eq(readers.id, readerId))
    .limit(1);
  return requireOwner(row?.userId, !!row, "Reader");
}

export async function requireOrderOwner(
  orderId: string | null | undefined
): Promise<AuthResult> {
  if (!orderId) return deny(404, "Order not found");
  const [row] = await db
    .select({ userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return requireOwner(row?.userId, !!row, "Order");
}

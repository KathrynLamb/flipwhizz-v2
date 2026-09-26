// src/app/api/readers/[readerId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { readers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireReaderOwner } from "@/lib/apiAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ readerId: string }> }
) {
  const { readerId } = await params;
  const ownerCheck = await requireReaderOwner(readerId);
  if (!ownerCheck.ok) return ownerCheck.response;
  const body = await req.json();

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.name) updates.name = body.name;
  if (body.gender) updates.gender = body.gender;
  if (body.pronouns) updates.pronouns = body.pronouns;

  await db.update(readers).set(updates).where(eq(readers.id, readerId));

  return NextResponse.json({ ok: true });
}
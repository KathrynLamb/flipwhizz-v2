// src/lib/admin/finish.ts
//
// Lightweight (db only) so Inngest functions can report back to the admin
// log without pulling in auth code: marks an admin job done or failed.

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminActions } from "@/db/schema";

/** Only moves a "started" job on (a job stopped by the admin stays stopped). */
export async function finishAdminAction(id: string | null | undefined, patch: { status: "done" | "failed"; result?: string }) {
  if (!id) return;
  try {
    await db
      .update(adminActions)
      .set({ status: patch.status, result: patch.result?.slice(0, 2000) ?? null, finishedAt: new Date() })
      .where(and(eq(adminActions.id, id), eq(adminActions.status, "started")));
  } catch (err) {
    console.error("[admin] could not finish action:", err);
  }
}

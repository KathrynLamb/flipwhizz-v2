// src/lib/authz.ts
//
// Route guard. Each API route declares WHAT it acts on and WHERE the id
// comes from; the guard checks the signed-in user owns it (admin always
// passes). Used as:
//
//   async function _POST(req: Request, ctx: Ctx) { ... }
//   export const POST = withAccess({ story: { param: "id" } }, _POST);
//
// Responses: 401 not signed in, 404 not found OR not yours (so we never
// reveal that someone else's story exists), 400 missing id.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { captureServerEvent } from "@/lib/posthog-server";

export type IdSource =
  | { param: string }
  | { body: string }
  | { query: string }
  | { form: string };

type Resource =
  | "story"
  | "project"
  | "character"
  | "location"
  | "reader"
  | "world"
  | "order"
  | "styleGuide"
  | "coverSession";

export type AccessCheck =
  | { login: true }
  | { admin: true }
  | ({ [K in Resource]?: IdSource } & { optional?: boolean });

export interface AccessOptions {
  /** Body fields that must equal the signed-in user's id / email if present. */
  bodyUserIdField?: string;
  bodyEmailField?: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  isAdmin: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const email = session?.user?.email ?? null;
  const admin = process.env.ADMIN_EMAIL;
  return { id, email, isAdmin: Boolean(admin && email === admin) };
}

type Row = Record<string, unknown>;
async function exists(q: ReturnType<typeof sql>): Promise<boolean> {
  const res = (await db.execute(q)) as unknown;
  const rows = Array.isArray(res) ? (res as Row[]) : (((res as { rows?: Row[] })?.rows ?? []) as Row[]);
  return rows.length > 0;
}

/** Does userId own this resource? Exported so handlers can do extra checks. */
export async function owns(resource: Resource, id: string, userId: string): Promise<boolean> {
  if (resource !== "order" && !UUID_RE.test(id)) return false;
  switch (resource) {
    case "story":
      return exists(sql`SELECT 1 FROM stories s JOIN projects p ON p.id = s.project_id
                        WHERE s.id = ${id} AND p.user_id = ${userId} LIMIT 1`);
    case "project":
      return exists(sql`SELECT 1 FROM projects WHERE id = ${id} AND user_id = ${userId} LIMIT 1`);
    case "character":
      return exists(sql`SELECT 1 FROM characters WHERE id = ${id} AND user_id = ${userId} LIMIT 1`);
    case "location":
      return exists(sql`SELECT 1 FROM locations WHERE id = ${id} AND user_id = ${userId} LIMIT 1`);
    case "reader":
      return exists(sql`SELECT 1 FROM readers WHERE id = ${id} AND user_id = ${userId} LIMIT 1`);
    case "world":
      return exists(sql`SELECT 1 FROM worlds WHERE id = ${id} AND user_id = ${userId} LIMIT 1`);
    case "order":
      return exists(sql`SELECT 1 FROM orders WHERE id = ${id} AND user_id = ${userId} LIMIT 1`);
    case "styleGuide":
      return exists(sql`SELECT 1 FROM story_style_guide g
                        JOIN stories s ON s.id = g.story_id
                        JOIN projects p ON p.id = s.project_id
                        WHERE g.id = ${id} AND p.user_id = ${userId} LIMIT 1`);
    case "coverSession":
      return exists(sql`SELECT 1 FROM cover_chat_sessions c
                        JOIN stories s ON s.id = c.story_id
                        JOIN projects p ON p.id = s.project_id
                        WHERE c.id = ${id} AND p.user_id = ${userId} LIMIT 1`);
  }
}

const deny = (status: 400 | 401 | 403 | 404, error: string) => NextResponse.json({ error }, { status });

async function readId(
  src: IdSource,
  req: Request,
  ctx: unknown,
  cache: { body?: Row | null; form?: FormData | null },
): Promise<string | null> {
  const asStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  if ("param" in src) {
    const raw = (ctx as { params?: unknown } | undefined)?.params;
    const params = (raw && typeof (raw as Promise<unknown>).then === "function" ? await raw : raw) as Row | undefined;
    return asStr(params?.[src.param]);
  }
  if ("query" in src) {
    try {
      return asStr(new URL(req.url).searchParams.get(src.query));
    } catch {
      return null;
    }
  }
  if ("body" in src) {
    if (cache.body === undefined) {
      try {
        cache.body = (await req.clone().json()) as Row;
      } catch {
        cache.body = null;
      }
    }
    return asStr(cache.body?.[src.body]);
  }
  if (cache.form === undefined) {
    try {
      cache.form = await req.clone().formData();
    } catch {
      cache.form = null;
    }
  }
  return asStr(cache.form?.get(src.form));
}

export function withAccess<A extends unknown[]>(
  checks: AccessCheck | AccessCheck[],
  handler: (...args: A) => Promise<Response>,
  opts: AccessOptions = {},
) {
  const list = Array.isArray(checks) ? checks : [checks];

  return async (...args: A): Promise<Response> => {
    const req = args[0] as Request;
    const ctx = args[1];

    const user = await getAuthUser();
    if (!user) return deny(401, "Please sign in to continue.");

    const cache: { body?: Row | null; form?: FormData | null } = {};
    const denied = async (status: 400 | 403 | 404, error: string, detail: Record<string, unknown>) => {
      // Signed-in user refused: record it, so a wrong rule shows up in PostHog
      // as a spike of access_denied rather than silent "not found" errors.
      try {
        await captureServerEvent(user.id, "access_denied", {
          status,
          path: (() => {
            try {
              return new URL(req.url).pathname;
            } catch {
              return null;
            }
          })(),
          ...detail,
        });
      } catch {
        /* non-fatal */
      }
      return deny(status, error);
    };

    for (const check of list) {
      if ("login" in check) continue;
      if ("admin" in check) {
        if (!user.isAdmin) return denied(404, "Not found", { rule: "admin" });
        continue;
      }
      const { optional, ...resources } = check as { optional?: boolean } & Record<string, IdSource>;
      for (const [resource, src] of Object.entries(resources)) {
        const id = await readId(src, req, ctx, cache);
        if (!id) {
          if (optional) continue;
          return denied(400, `Missing ${resource} id`, { resource, reason: "missing_id" });
        }
        if (user.isAdmin) continue;
        let ok = false;
        try {
          ok = await owns(resource as Resource, id, user.id);
        } catch (err) {
          console.error(`[authz] ownership check failed for ${resource} ${id}:`, err);
          ok = false;
        }
        if (!ok) return denied(404, "Not found", { resource, id, reason: "not_owner" });
      }
    }

    if (!user.isAdmin && (opts.bodyUserIdField || opts.bodyEmailField)) {
      if (cache.body === undefined) {
        try {
          cache.body = (await req.clone().json()) as Row;
        } catch {
          cache.body = null;
        }
      }
      const b = cache.body ?? {};
      if (opts.bodyUserIdField && b[opts.bodyUserIdField] != null && b[opts.bodyUserIdField] !== user.id) {
        return denied(403, "Not allowed", { reason: "body_user_mismatch" });
      }
      if (
        opts.bodyEmailField &&
        b[opts.bodyEmailField] != null &&
        String(b[opts.bodyEmailField]).toLowerCase() !== (user.email ?? "").toLowerCase()
      ) {
        return denied(403, "Not allowed", { reason: "body_email_mismatch" });
      }
    }

    return handler(...args);
  };
}

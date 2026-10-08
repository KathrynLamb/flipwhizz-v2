// src/app/api/admin/health/route.ts
//
// Admin-only. GET returns the live health report as JSON. Emailing the
// digest is a button on /admin/tools (POST /api/admin/tools).
import { NextResponse } from "next/server";
import { withAccess } from "@/lib/authz";
import { runHealthCheck } from "@/lib/healthCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function _GET() {
  return NextResponse.json(await runHealthCheck());
}

export const GET = withAccess({ admin: true }, _GET);

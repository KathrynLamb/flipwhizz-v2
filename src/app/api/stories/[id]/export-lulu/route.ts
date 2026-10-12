import { NextResponse } from "next/server";
import { withAccess } from "@/lib/authz";
import { buildColouringFiles } from "@/lib/lulu/export";
export const runtime = "nodejs";
export const maxDuration = 300;
async function exportFiles(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await buildColouringFiles((await params).id, true)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Export failed" }, { status: 400 }); }
}
export const POST = withAccess({ story: { param: "id" } }, exportFiles);

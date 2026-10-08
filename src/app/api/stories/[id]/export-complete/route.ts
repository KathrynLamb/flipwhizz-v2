// src/app/api/stories/[id]/export-complete/route.ts
//
// The customer's "Export PDF": builds the complete print PDF and saves it
// on the book (the file print orders send to Gelato). The work is in
// src/lib/print/buildCompletePdf.ts, shared with the admin Book page.

import { NextResponse } from "next/server";
import { withAccess } from "@/lib/authz";
import { buildCompletePdf, PdfBuildError } from "@/lib/print/buildCompletePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storyId } = await params;
  if (!storyId) {
    return NextResponse.json({ error: "Missing story id" }, { status: 400 });
  }

  try {
    const r = await buildCompletePdf(storyId, { save: true });
    console.log("🟢 export-complete: complete", { storyId, url: r.url });
    return NextResponse.json({
      url: r.url,
      productType: r.productType,
      coverType: r.coverType,
      readerName: r.readerName,
    });
  } catch (err) {
    const e = err instanceof PdfBuildError ? err : new PdfBuildError(500, err instanceof Error ? err.message : String(err), "unknown");
    if (e.status !== 500) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("❌ Export complete PDF failed", { storyId, stage: e.stage, error: e.message });
    return NextResponse.json({ error: "Failed to export PDF", stage: e.stage, details: e.message }, { status: 500 });
  }
}

export const POST = withAccess({ story: { param: "id" } }, _POST);

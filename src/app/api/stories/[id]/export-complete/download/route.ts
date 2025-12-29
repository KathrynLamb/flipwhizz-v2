
// API Route: /api/stories/[id]/export-complete/download/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  const filePath = path.join(
    process.cwd(),
    "tmp",
    `complete-${storyId}.pdf`
  );

  try {
    const file = await fs.readFile(filePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gelato-ready-${storyId}.pdf"`,
      },
    });
  } catch (err) {
    console.error("❌ PDF not found:", err);
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }
}
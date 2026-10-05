// src/app/api/stories/[id]/export-pdf/download/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { withAccess } from "@/lib/authz";

export const runtime = "nodejs";

async function _GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  const filePath = path.join(
    process.cwd(),
    "tmp",
    `story-${storyId}.pdf`
  );

  try {
    const file = await fs.readFile(filePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="story-${storyId}.pdf"`,
      },
    });
  } catch (err) {
    console.error("❌ PDF not found:", err);
    return NextResponse.json(
      { error: "PDF not found" },
      { status: 404 }
    );
  }
}

export const GET = withAccess({ story: { param: "id" } }, _GET);

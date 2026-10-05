import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/firebaseAdmin";
import { v4 as uuid } from "uuid";
import { withAccess } from "@/lib/authz";

async function _POST(req: NextRequest) {
  try {
    const { fileType, storyId } = await req.json();

    if (!fileType || !storyId) {
      return NextResponse.json(
        { error: "Missing fileType or storyId" },
        { status: 400 }
      );
    }

    const fileName = `story-references/${storyId}/${uuid()}`;
    const file = bucket.file(fileName);

    // Signed URL for direct upload
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 mins
      contentType: fileType,
    });

    return NextResponse.json({
      uploadUrl: url,
      path: fileName,
    });
  } catch (err) {
    console.error("❌ upload-url error", err);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}

export const POST = withAccess({ story: { body: "storyId" }, optional: true }, _POST);

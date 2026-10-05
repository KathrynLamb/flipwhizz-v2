import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  // Only proxy Cloudinary images. Parse the hostname properly: a plain
  // includes("cloudinary.com") check let any URL through, e.g.
  // https://evil.example/?cloudinary.com
  let parsed: URL | null = null;
  try {
    parsed = url ? new URL(url) : null;
  } catch {
    parsed = null;
  }
  const host = parsed?.hostname ?? "";
  if (!parsed || parsed.protocol !== "https:" || !(host === "res.cloudinary.com" || host.endsWith(".cloudinary.com"))) {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const res = await fetch(parsed.toString());
  if (!res.ok) return new NextResponse("Image not found", { status: 404 });
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
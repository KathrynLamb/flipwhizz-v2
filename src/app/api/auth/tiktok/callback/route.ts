import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied
  if (error) {
    return NextResponse.redirect(new URL("/?tiktok=denied", req.url));
  }

  // Validate state
  const storedState = req.cookies.get("tt_oauth_state")?.value;
  const codeVerifier = req.cookies.get("tt_code_verifier")?.value;

  if (!code || !state || state !== storedState || !codeVerifier) {
    return NextResponse.redirect(new URL("/?tiktok=error", req.url));
  }

  // Exchange code for token
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/tiktok/callback`,
      code_verifier: codeVerifier,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    console.error("TikTok token exchange failed:", tokenData);
    return NextResponse.redirect(new URL("/?tiktok=error", req.url));
  }

  // Store token against user
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  await db
    .update(users)
    .set({
      tiktokAccessToken: tokenData.access_token,
      tiktokOpenId: tokenData.open_id,
      tiktokTokenExpiresAt: expiresAt,
    })
    .where(eq(users.id, (session.user as any).id));

  // Clear cookies and redirect back to the story
  const response = NextResponse.redirect(
    new URL("/?tiktok=connected", req.url)
  );
  response.cookies.delete("tt_oauth_state");
  response.cookies.delete("tt_code_verifier");

  return response;
}
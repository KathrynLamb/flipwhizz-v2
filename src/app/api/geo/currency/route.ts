// src/app/api/geo/currency/route.ts

import { NextRequest, NextResponse } from "next/server";
import { countryToCurrency } from "@/lib/pricing";

export const runtime = "edge"; // Edge for fastest geo response

export async function GET(req: NextRequest) {
  // Vercel provides these headers automatically on Vercel-hosted deployments
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ?? // Cloudflare fallback
    null;

  const city = req.headers.get("x-vercel-ip-city") ?? null;
  const region = req.headers.get("x-vercel-ip-country-region") ?? null;

  const currency = countryToCurrency(country);

  return NextResponse.json({
    country,
    city,
    region,
    currency,
  });
}
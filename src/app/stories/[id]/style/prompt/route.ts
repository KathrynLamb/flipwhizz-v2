import { NextResponse } from "next/server";
import { getUnifiedStylePrompt } from "@/lib/getStylePrompt";

export async function GET(_req: Request, { params }: any) {
  const prompt = await getUnifiedStylePrompt(params.id);
  return NextResponse.json({ prompt });
}

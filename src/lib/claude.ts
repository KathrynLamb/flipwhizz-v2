// src/lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export function extractClaudeText(content: any): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?.type === "text")
    .map((b) => String(b?.text ?? ""))
    .join("\n")
    .trim();
}

export async function claudeChat(opts: {
  system?: string;
  messages: ClaudeMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
}) {
  const {
    system,
    messages,
    model = "claude-sonnet-4-5",
    max_tokens = 1000,
    temperature,
  } = opts;

  // Alias is fine for dev; for production you can pin a snapshot:
  // claude-sonnet-4-5-20250929
  // per Anthropic's model docs. :contentReference[oaicite:0]{index=0}

  return client.messages.create({
    model,
    system,
    messages,
    max_tokens,
    ...(typeof temperature === "number" ? { temperature } : {}),
  });
}

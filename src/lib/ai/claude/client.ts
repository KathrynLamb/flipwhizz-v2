// src/lib/ai/claude/client.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export type ClaudeRole = "user" | "assistant";

export type ClaudeMessage = {
  role: ClaudeRole;
  content: string;
};

export type ClaudeChatOpts = {
  system?: string;
  messages: ClaudeMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
};

function extractText(res: any) {
  // Safe text extraction across SDK output shapes
  if (!res?.content) return "";
  return res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

export async function claude(opts: ClaudeChatOpts) {
  const res = await client.messages.create({
    model: opts.model ?? "claude-sonnet-4-5",
    max_tokens: opts.max_tokens ?? 1000,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,         // ✅ system belongs here
    messages: opts.messages,     // ✅ only user/assistant
  });

  const text = extractText(res);

  return { raw: res, text };
}

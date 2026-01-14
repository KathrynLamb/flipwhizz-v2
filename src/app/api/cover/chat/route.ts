import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { 
      storyId, 
      storyTitle, 
      storySummary,   
      characters,     
      message, 
      history = [] // Default to empty array
    } = await req.json();

    const systemPrompt = `
You are a world-class Art Director for children's books. Your goal is to guide the user to a "Dream Cover" design as efficiently as possible.

**CONTEXT:**
- Title: "${storyTitle}"
- Plot: "${storySummary || 'A magical journey...'}"
- Key Characters: "${JSON.stringify(characters) || 'The main protagonist'}"

**YOUR PROCESS (Follow strictly):**

1. **PHASE 1: THE PITCH**
   - Analyze the title/plot and **PROPOSE** a specific, vivid cover concept immediately.
   - Describe a scene that connects the Front (Action/Hero) and Back (Context/Setting) seamlessly.
   - Ask: "How does that sound, or would you prefer a different focus?"

2. **PHASE 2: REFINEMENT**
   - If the user likes the idea, refine details: Lighting, Mood, Typography placement.
   - If they dislike it, offer a radically different angle.

3. **PHASE 3: CONFIRMATION**
   - Once the user seems happy, ask: "Shall we generate this design?"

**DESIGN RULES:**
- This is a **WRAP-AROUND (2:1 ratio)** image. Flow from back (left) to front (right).
- **Front Cover (Right):** Negative space for Title. Focus on Hero.
- **Back Cover (Left):** Space for blurb. Scenery or secondary character.
- **Style:** Whimsical, Warm, Painterly.

**TONE:**
- Enthusiastic, Insightful, and Brief (max 4 sentences).
`.trim();

    // 1. Prepare history
    const messages = history.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 2. Add current user message if provided
    if (message) {
      messages.push({ role: "user", content: message });
    }

    // 3. 🚨 CRITICAL FIX: Handle Empty State (The "Pitch" Trigger)
    // Anthropic requires at least 1 message. If empty, we inject a prompt to start Phase 1.
    if (messages.length === 0) {
      messages.push({ 
        role: "user", 
        content: "Please review the story details and pitch me a cover concept." 
      });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    // Extract text content safely
    const textContent = response.content.find(c => c.type === 'text');
    const reply = textContent ? textContent.text : "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Cover chat error:", err);
    return NextResponse.json(
      { error: "Chat failed" },
      { status: 500 }
    );
  }
}
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateStoryText(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  })

  const block = message.content[0]
  if (block.type !== "text") throw new Error("Unexpected response type from Claude")
  return block.text
}

// Streaming version — yields chunks for real-time display
export async function* generateStoryStream(
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string> {
  const stream = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
    stream: true,
  })

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text
    }
  }
}

// Extract a title from the generated story content
export async function extractStoryTitle(content: string, childName: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 50,
    messages: [{
      role: "user",
      content: `Generate a short, charming title (5 words or fewer) for this children's bedtime story. Return only the title, nothing else.\n\n${content.slice(0, 500)}`
    }],
  })

  const block = message.content[0]
  if (block.type !== "text") return `${childName}'s Story`
  return block.text.trim().replace(/^["']|["']$/g, "") || `${childName}'s Story`
}

import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-beta": "prompt-caching-2024-07-31",
  },
})

export async function* generateStoryStream(
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string> {
  const stream = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: systemPrompt,
        // @ts-expect-error — cache_control is a beta field not yet in SDK types
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
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

export async function extractStoryTitle(content: string, childName: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 50,
    messages: [{
      role: "user",
      content: `Generate a short, charming title (5 words or fewer) for this children's bedtime story. Return only the title, nothing else.\n\n${content.slice(0, 500)}`,
    }],
  })

  const block = message.content[0]
  if (block.type !== "text") return `${childName}'s Story`
  return block.text.trim().replace(/^["']|["']$/g, "") || `${childName}'s Story`
}

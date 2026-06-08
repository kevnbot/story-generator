"use server"

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function genericizeToyDescription(
  toyName: string,
  toyDescription?: string | null
): Promise<string | null> {
  if (!toyName.trim()) return null

  const input = toyDescription
    ? `Toy name: "${toyName}"\nDescription: "${toyDescription}"`
    : `Toy name: "${toyName}"`

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: `You are helping generate descriptions for children's book illustrations. A parent has described their child's toy. Your job is to rewrite the toy description in generic, visual terms that do not include any brand names, trademarked character names, or copyrighted property names.

Rules:
- Describe only physical appearance: shape, color, material, size, clothing/features
- Do not use any brand names or franchise character names
- Do not add details that weren't in the original description
- Write one sentence, present tense, describing the toy as a standalone object
- End with: "displayed alone on a plain white background"

${input}

Respond with only the rewritten description. No preamble, no quotes.`,
        },
      ],
    })

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    return text.length > 0 ? text : null
  } catch {
    return null
  }
}

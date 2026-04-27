import Anthropic from "@anthropic-ai/sdk"
import type { KidProfile } from "@/types"

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
    model: "claude-sonnet-4-6",
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

// Matches page-break marker lines like: ---**Page 2**, **Page 2**, --- Page 2 ---
const PAGE_BREAK_RE = /^[-–—*\s]*(?:\*{0,2})\s*Page\s+\d+\s*(?:\*{0,2})[-–—*\s]*$/im

// Splits completed story text into per-page sections.
// Uses explicit page-break markers when present; falls back to double-newline paragraphs.
export function splitStoryPages(content: string): string[] {
  const lines = content.split("\n")
  const sections: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (PAGE_BREAK_RE.test(line)) {
      const section = current.join("\n").trim()
      if (section) sections.push(section)
      current = []
    } else {
      current.push(line)
    }
  }
  const last = current.join("\n").trim()
  if (last) sections.push(last)

  if (sections.length > 1) return sections

  // Fallback: split by blank lines
  return content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
}

export interface StoryVisuals {
  // Maps character name → consistent outfit description used in every page prompt
  outfits: Record<string, string>
  // One vivid scene description per story page
  scenes: string[]
}

// Single Haiku call that produces two things needed for image generation:
// 1. A consistent outfit for each character (same across all pages)
// 2. A specific, vivid scene description for each page
export async function extractStoryVisuals(
  pageTexts: string[],
  profiles: KidProfile[]
): Promise<StoryVisuals> {
  const fallback: StoryVisuals = {
    outfits: Object.fromEntries(profiles.map((p) => [p.name, ""])),
    scenes: pageTexts.map((_, i) => `scene from page ${i + 1}`),
  }

  const profileLines = profiles
    .map((p) => `- ${p.name} (${p.gender ?? "child"}, age ${p.age}): ${p.prompt_summary}`)
    .join("\n")

  const pageLines = pageTexts
    .map((text, i) => `Page ${i + 1}: "${text.slice(0, 500)}"`)
    .join("\n\n")

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an art director preparing image prompts for a children's picture book illustrator.

CHARACTER PROFILES:
${profileLines}

STORY PAGES:
${pageLines}

Complete two tasks:

TASK 1 — OUTFITS: For each character, choose one specific outfit they wear consistently in every illustration. Pick something fitting for their age, personality, and the story's tone. Be specific about colors, style, and any accessories.
Example: "wears a bright red hooded raincoat, blue denim overalls, and yellow rain boots"

TASK 2 — SCENES: For each story page, write ONE vivid sentence describing exactly what to illustrate. Include: the specific action happening, the setting/environment, key objects or props, and the mood. Be concrete and visual — avoid vague phrases like "they explore" or "they have fun".
Example: "Emma and Jake crouch beside a glowing purple mushroom in a misty forest, their faces lit with wonder as tiny fairies peek out from behind the cap"

Return ONLY this JSON, no other text:
{
  "outfits": [{ "name": "...", "outfit": "..." }],
  "scenes": ["...", "..."]
}`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== "text") return fallback

  try {
    const match = block.text.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])

    const outfits: Record<string, string> = {}
    for (const entry of parsed.outfits ?? []) {
      if (entry.name && entry.outfit) outfits[entry.name] = entry.outfit
    }

    const scenes = (parsed.scenes ?? []) as string[]
    return {
      outfits,
      scenes: pageTexts.map((_, i) => scenes[i] ?? fallback.scenes[i]),
    }
  } catch {
    return fallback
  }
}

export async function extractStoryTitle(content: string, childName: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
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

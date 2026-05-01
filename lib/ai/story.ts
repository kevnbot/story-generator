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
  // The prompt sent to Haiku to extract these visuals
  prompt: string
}

// Single Haiku call that produces two things needed for image generation:
// 1. A consistent outfit for each character (same across all pages)
// 2. A specific, vivid scene description for each page
export async function extractStoryVisuals(
  pageTexts: string[],
  profiles: KidProfile[],
  profilesWithRef: Set<string> = new Set()
): Promise<StoryVisuals> {
  const profileLines = profiles
    .map((p) => {
      const genderLabel = p.gender ?? "child"
      const hasRef = profilesWithRef.has(p.id)

      if (hasRef) {
        // Appearance is defined by the reference image — only include narrative fields
        const personality = p.personality_tags.length > 0
          ? ` Personality: ${p.personality_tags.join(", ")}.`
          : ""
        const toyName = p.toy?.name && p.toy.name !== "their favorite toy" ? p.toy.name : null
        const toyFull = toyName
          ? (p.toy.description ? `${toyName} (${p.toy.description})` : toyName)
          : null
        const toyStr = toyFull ? ` Toy: ${toyFull}.` : ""
        return `- ${p.name} (${genderLabel}, age ${p.age}): appearance defined by reference image.${personality}${toyStr}`
      }

      // No reference image — include full appearance so scenes anchor the illustrator
      const skinTone = p.appearance?.skin_tone ? `, ${p.appearance.skin_tone} skin` : ""
      return `- ${p.name} (${genderLabel}${skinTone}, age ${p.age}): ${p.prompt_summary}`
    })
    .join("\n")

  const pageLines = pageTexts
    .map((text, i) => `Page ${i + 1}: "${text}"`)
    .join("\n\n")

  const prompt = `You are an art director preparing image prompts for a children's picture book illustrator.

CHARACTER PROFILES:
${profileLines}

STORY PAGES:
${pageLines}

CRITICAL RULE: All characters are human children. If a character owns an animal toy (stuffed animal, plushie), that toy is a separate physical object they carry in their hands — the child themselves has NO animal features, fur, ears, tails, or characteristics of the toy. In your scene descriptions, always make this separation explicit (e.g. "Mack, a human boy, holds his chipmunk plushie up to the light" NOT "Mack scurries like a chipmunk"). Never describe a child as becoming, resembling, or having features of their toy animal.

Complete two tasks:

TASK 1 — OUTFITS: For each character, choose one specific outfit they wear consistently in every illustration. Pick something fitting for their age, personality, and the story's tone. Be specific about colors, style, and any accessories.
Example: "wears a bright red hooded raincoat, blue denim overalls, and yellow rain boots"

TASK 2 — SCENES: For each story page, write 2-3 vivid sentences describing exactly what to illustrate. Include: the specific action happening, the setting/environment, key objects or props, and the mood. Be concrete and visual — avoid vague phrases like "they explore" or "they have fun". When a character's toy appears in a scene, describe it explicitly as a held stuffed animal or plushie separate from the child's body.

GENDER AND APPEARANCE RULE: Always use each character's correct gendered pronouns (she/her for girls, he/his for boys). If a character has a gender-neutral name, include their gender explicitly — write "Charlie, the girl" rather than just "Charlie". Never use they/them for a character with a specified gender. For characters whose "appearance defined by reference image", describe them by WHAT THEY DO, not how they look — omit hair, eye, and skin descriptions in scenes, as those are handled by the reference image. For characters without a reference image, include their skin tone when first introducing them in a scene (e.g. "Mia, a girl with warm brown skin").
Example: "Emma and Jake crouch beside a glowing purple mushroom in a misty forest, their faces lit with wonder as tiny fairies peek out from behind the cap"

Return ONLY this JSON, no other text:
{
  "outfits": [{ "name": "...", "outfit": "..." }],
  "scenes": ["...", "..."]
}`

  const fallback: StoryVisuals = {
    outfits: Object.fromEntries(profiles.map((p) => [p.name, ""])),
    scenes: pageTexts.map((_, i) => `scene from page ${i + 1}`),
    prompt,
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
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
      prompt,
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

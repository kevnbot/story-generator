import Anthropic from "@anthropic-ai/sdk"

export interface StoryPageScene {
  pageIndex: number
  text: string
  action: string        // 2-3 sentences: what is visually happening on this page
  characters: string[]  // character names present on this page
  toys: string[]        // toy names present on this page
  setting: string       // specific location for this page
  mood: string          // warm / joyful / mysterious / calm / exciting / silly
}

export interface StoryVisualContext {
  setting: string               // primary story location
  timeOfDay: string             // morning / afternoon / evening / night
  recurringElements: string[]   // objects or places appearing across multiple pages
  outfits: Record<string, string> // character name → consistent outfit worn throughout the story
  pageScenes: StoryPageScene[]
}

export function buildVisualContextPrompt(
  storyPages: string[],
  characterNames: string[],
  toyNames: string[],
  artStyleDescription: string
): string {
  const pageLines = storyPages
    .map((text, i) => `Page ${i + 1}:\n"${text}"`)
    .join("\n\n")

  const characterList = characterNames.join(", ")
  const toyList = toyNames.length > 0 ? toyNames.join(", ") : "none"

  return `You are an art director preparing illustration briefs for a children's picture book in this style: ${artStyleDescription}.

CHARACTERS: ${characterList}
TOYS: ${toyList}

STORY PAGES:
${pageLines}

Read each page carefully. Your task is to extract visual context for an illustrator.

OUTFITS: For each character, choose one specific outfit they wear consistently in every illustration — something fitting for their age and the story's tone. Be specific about colors, style, and any accessories. Example: "bright red hooded raincoat, blue denim overalls, and yellow rain boots".

PAGES: For each page, describe exactly what is visually happening as if directing a scene — not plot summary, but concrete visual action. A director's instruction, not a narrator's summary. Also identify which named characters and which named toys physically appear on each page, the specific location, and the mood.

STORY CONTEXT: Identify the primary setting, the time of day (morning, afternoon, evening, or night), and any objects or places that recur across multiple pages.

Return ONLY valid JSON matching this exact shape — no markdown, no preamble:
{
  "setting": "primary story location",
  "timeOfDay": "morning | afternoon | evening | night",
  "recurringElements": ["element1", "element2"],
  "outfits": [
    { "name": "character name", "outfit": "specific outfit description" }
  ],
  "pageScenes": [
    {
      "pageIndex": 0,
      "text": "exact page text",
      "action": "2-3 sentences describing the concrete visual scene as if directing an illustrator",
      "characters": ["character names present on this page"],
      "toys": ["toy names present on this page"],
      "setting": "specific location for this page",
      "mood": "warm | joyful | mysterious | calm | exciting | silly"
    }
  ]
}`
}

export async function extractVisualContext(
  storyPages: string[],
  characterNames: string[],
  toyNames: string[],
  artStyleDescription: string
): Promise<StoryVisualContext> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = buildVisualContextPrompt(storyPages, characterNames, toyNames, artStyleDescription)

  const fallback: StoryVisualContext = {
    setting: "",
    timeOfDay: "evening",
    recurringElements: [],
    outfits: {},
    pageScenes: storyPages.map((text, i) => ({
      pageIndex: i,
      text,
      action: `scene from page ${i + 1}`,
      characters: characterNames,
      toys: toyNames,
      setting: "",
      mood: "warm",
    })),
  }

  let message: Anthropic.Message
  try {
    message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    })
  } catch {
    return fallback
  }

  const block = message.content[0]
  if (block.type !== "text") return fallback

  try {
    const match = block.text.match(/\{[\s\S]*\}/)
    if (!match) return fallback

    const parsed = JSON.parse(match[0]) as {
      setting?: string
      timeOfDay?: string
      recurringElements?: string[]
      outfits?: Array<{ name?: string; outfit?: string }>
      pageScenes?: Array<{
        pageIndex?: number
        text?: string
        action?: string
        characters?: string[]
        toys?: string[]
        setting?: string
        mood?: string
      }>
    }

    const outfits: Record<string, string> = {}
    for (const entry of parsed.outfits ?? []) {
      if (entry.name && entry.outfit) outfits[entry.name] = entry.outfit
    }

    const pageScenes: StoryPageScene[] = (parsed.pageScenes ?? []).map((scene, i) => ({
      pageIndex: scene.pageIndex ?? i,
      text: scene.text ?? storyPages[i] ?? "",
      action: scene.action ?? fallback.pageScenes[i]?.action ?? "",
      characters: scene.characters ?? characterNames,
      toys: scene.toys ?? [],
      setting: scene.setting ?? "",
      mood: scene.mood ?? "warm",
    }))

    // Ensure we have a scene entry for every page
    while (pageScenes.length < storyPages.length) {
      const i = pageScenes.length
      pageScenes.push(fallback.pageScenes[i])
    }

    return {
      setting: parsed.setting ?? "",
      timeOfDay: parsed.timeOfDay ?? "evening",
      recurringElements: parsed.recurringElements ?? [],
      outfits,
      pageScenes,
    }
  } catch {
    return fallback
  }
}

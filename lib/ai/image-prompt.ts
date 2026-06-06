import type { StoryPageScene, StoryVisualContext } from "@/lib/ai/prompt-builder/visual-context"
import type { CharacterReference } from "@/lib/ai/providers/image/options"
import { resolveCharacterReferences } from "@/lib/ai/providers/image/fal"

export const NEGATIVE_PROMPT =
  "animal features on children, animal ears on children, animal tails on children, fur on human characters, chipmunk features on child, cat features on child, dog features on child, child as animal, animal hybrid child, whiskers on human, child with tail"

export const HUMAN_RULE =
  "All characters are human children. Any toy is a separate physical object held or placed near the child — never attached to or part of the child's body. Children have no animal features, fur, tails, or ears."

export function buildStoryPagePrompt(input: {
  scene: StoryPageScene
  visualContext: StoryVisualContext
  artStylePrefix: string
  referenceAvailable: boolean
  characterDetails: {
    [name: string]: {
      gender: string
      age: number
      appearanceDescription?: string
      outfit?: string
      toyName?: string
      toyDescription?: string
    }
  }
  storyCharacters: {
    name: string
    description: string
    appearsOnPages: number[]
  }[]
  characterReferences?: CharacterReference[]
  storyCharacterRefs?: CharacterReference[]
}): string {
  const {
    scene,
    visualContext,
    artStylePrefix,
    referenceAvailable,
    characterDetails,
    storyCharacters,
    characterReferences,
    storyCharacterRefs,
  } = input

  const parts: string[] = []

  parts.push(artStylePrefix)

  const allRefs = [...(characterReferences ?? []), ...(storyCharacterRefs ?? [])]
  if (allRefs.length > 0) {
    const { labels } = resolveCharacterReferences(allRefs)
    const refLine = labels.map((label, i) => `@Image${i + 1} is ${label}.`).join(" ")
    parts.push(`Reference images provided: ${refLine} Preserve each referenced person's visual identity and use the matching reference image for their appearance.`)
  }

  const contextParts: string[] = []
  if (visualContext.setting) contextParts.push(visualContext.setting)
  if (visualContext.timeOfDay) contextParts.push(visualContext.timeOfDay)
  if (contextParts.length > 0) parts.push(`Setting: ${contextParts.join(", ")}`)

  for (const name of scene.characters) {
    const detail = characterDetails[name]
    if (!detail) continue

    const humanGender = detail.gender === "girl" ? "human girl"
      : detail.gender === "boy" ? "human boy"
      : "human child"

    let line = `${name} — ${humanGender}, age ${detail.age}`

    if (!referenceAvailable) {
      if (detail.appearanceDescription) line += `, ${detail.appearanceDescription}`
      const outfit = detail.outfit ?? visualContext.outfits[name]
      if (outfit) line += `, ${outfit}`
    }

    line += "."

    if (detail.toyName) {
      const pronoun = detail.gender === "girl" ? "Her" : detail.gender === "boy" ? "His" : "Their"
      const toyDesc = detail.toyDescription ? ` (${detail.toyDescription})` : ""
      line += ` ${pronoun} toy: ${detail.toyName}${toyDesc}.`
    }

    parts.push(line)
  }

  const storyCharsWithImageRef = new Set((storyCharacterRefs ?? []).map(r => r.name))
  const storyCharsOnPage = storyCharacters.filter(sc => sc.appearsOnPages.includes(scene.pageIndex))
  for (const sc of storyCharsOnPage) {
    if (!storyCharsWithImageRef.has(sc.name)) {
      parts.push(`${sc.name} — ${sc.description}.`)
    }
  }

  if (scene.characters.length + storyCharsOnPage.length >= 3) {
    parts.push("All characters listed above must be fully visible in the scene — do not omit any.")
  }

  if (scene.action) parts.push(scene.action)

  if (scene.mood) parts.push(`Mood: ${scene.mood}.`)

  if (referenceAvailable || allRefs.length > 0) {
    parts.push("Profile character appearances are defined by the reference images — do not alter them.")
  }

  parts.push("All characters are human. Any toy is a separate physical object — never part of a character's body.")

  return parts.join(" ")
}

export function buildReferenceStylePrompt(styleDescription: string): string {
  return `${styleDescription}. Maintain all character identities, proportions, and positions exactly as shown. Apply only the artistic rendering style — do not change who is in the image or how they are posed.`
}

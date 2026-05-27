import type { StoryPageScene, StoryVisualContext } from "@/lib/ai/prompt-builder/visual-context"

export const NEGATIVE_PROMPT =
  "animal features on children, animal ears on children, animal tails on children, fur on human characters, chipmunk features on child, cat features on child, dog features on child, child as animal, animal hybrid child, whiskers on human, child with tail"

export const HUMAN_RULE =
  "All characters are human children. Any toy is a separate physical object held or placed near the child — never attached to or part of the child's body. Children have no animal features, fur, tails, or ears."

export function buildStoryPagePrompt(input: {
  scene: StoryPageScene
  visualContext: StoryVisualContext
  artStylePrefix: string
  referenceAvailable: boolean
  characterDescriptions: string
}): string {
  const { scene, visualContext, artStylePrefix, referenceAvailable, characterDescriptions } = input

  const parts: string[] = []

  parts.push(artStylePrefix)

  const contextParts: string[] = []
  if (visualContext.setting) contextParts.push(visualContext.setting)
  if (visualContext.timeOfDay) contextParts.push(visualContext.timeOfDay)
  if (contextParts.length > 0) parts.push(`Setting: ${contextParts.join(", ")}`)

  if (scene.action) parts.push(scene.action)

  if (referenceAvailable) {
    if (scene.characters.length > 0) {
      parts.push(`Characters present: ${scene.characters.join(", ")}. Match their exact appearances from the reference image.`)
    }
  } else if (characterDescriptions) {
    parts.push(`Characters: ${characterDescriptions}.`)
    const outfitLines = scene.characters
      .flatMap(name => {
        const outfit = visualContext.outfits[name]
        return outfit ? [`${name}: ${outfit}`] : []
      })
    if (outfitLines.length > 0) {
      parts.push(`Outfits: ${outfitLines.join("; ")}.`)
    }
  }

  if (scene.toys.length > 0) {
    parts.push(`Toys present: ${scene.toys.join(", ")}.`)
  }

  if (scene.mood) parts.push(`Mood: ${scene.mood}.`)

  if (referenceAvailable) {
    parts.push("Maintain exact character appearances from the reference image.")
  }

  parts.push(HUMAN_RULE)

  return parts.join(" ")
}

export function buildReferenceStylePrompt(styleDescription: string): string {
  return `${styleDescription}. Maintain all character identities, proportions, and positions exactly as shown. Apply only the artistic rendering style — do not change who is in the image or how they are posed.`
}

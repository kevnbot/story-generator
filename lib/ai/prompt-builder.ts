import type { KidProfile, KidAppearance, KidToy } from "@/types"

function buildAppearanceSummary(appearance: KidAppearance): string {
  const parts: string[] = []
  if (appearance.hair_color && appearance.hair_style)
    parts.push(`${appearance.hair_color} ${appearance.hair_style} hair`)
  else if (appearance.hair_color)
    parts.push(`${appearance.hair_color} hair`)
  if (appearance.eye_color) parts.push(`${appearance.eye_color} eyes`)
  if (appearance.skin_tone) parts.push(`${appearance.skin_tone} skin`)
  if (appearance.glasses) parts.push("wears glasses")
  if (appearance.freckles) parts.push("has freckles")
  if (appearance.other) parts.push(appearance.other)
  return parts.join(", ")
}

function buildToySummary(toy: KidToy): string {
  const parts: string[] = []
  if (toy.name) parts.push(toy.name)
  if (toy.type) parts.push(`(a ${toy.type})`)
  if (toy.color) parts.push(`— ${toy.color}`)
  if (toy.description) parts.push(`— ${toy.description}`)
  if (toy.backstory) parts.push(`. ${toy.backstory}`)
  return parts.join(" ")
}

// Builds the prompt_summary string stored on the profile row.
// This is what gets injected into story and image API calls.
export function buildPromptSummary(profile: Pick<KidProfile, "name" | "age" | "appearance" | "personality_tags" | "toy">): string {
  const parts: string[] = []

  const appearance = buildAppearanceSummary(profile.appearance)
  if (appearance) parts.push(`${profile.name} has ${appearance}.`)

  if (profile.personality_tags.length > 0)
    parts.push(`${profile.name} is ${profile.personality_tags.join(", ")}.`)

  const toy = buildToySummary(profile.toy)
  if (toy) parts.push(`Their favorite toy is ${toy}.`)

  return parts.join(" ")
}

// Fills template placeholders with profile data
export function fillPromptTemplate(template: string, profile: KidProfile): string {
  const appearanceSummary = buildAppearanceSummary(profile.appearance)
  const toySummary = buildToySummary(profile.toy)

  return template
    .replace(/{{child_name}}/g, profile.name)
    .replace(/{{child_age}}/g, String(profile.age))
    .replace(/{{prompt_summary}}/g, profile.prompt_summary)
    .replace(/{{appearance_summary}}/g, appearanceSummary)
    .replace(/{{toy_summary}}/g, toySummary)
    .replace(/{{personality_tags}}/g, profile.personality_tags.join(", "))
}

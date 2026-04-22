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

// Joins a list of names naturally: "Emma", "Emma and Jake", "Emma, Jake, and Sophie"
export function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1]
}

// Builds the prompt_summary string stored on the profile row.
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

// Fills template placeholders for a single profile
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

// Fills template placeholders for multiple profiles.
// Falls back to single-profile logic when only one profile is provided.
export function fillPromptTemplateMulti(template: string, profiles: KidProfile[]): string {
  if (profiles.length === 1) return fillPromptTemplate(template, profiles[0])

  const names = joinNames(profiles.map(p => p.name))

  // "5 and 7" or "5, 7, and 8"
  const ages = joinNames(profiles.map(p => String(p.age)))

  // Full per-child description block for {{prompt_summary}}
  const combinedSummary = profiles
    .map(p => {
      const lines: string[] = [`${p.name} (age ${p.age}):`, p.prompt_summary]
      return lines.join(" ")
    })
    .join(" ")

  // "Emma has brown hair; Jake has blonde hair"
  const combinedAppearance = profiles
    .map(p => {
      const a = buildAppearanceSummary(p.appearance)
      return a ? `${p.name} has ${a}` : ""
    })
    .filter(Boolean)
    .join("; ")

  // "Emma's toy is Teddy; Jake's toy is Rocket"
  const combinedToys = profiles
    .map(p => {
      const t = buildToySummary(p.toy)
      return t ? `${p.name}'s favorite toy is ${t}` : ""
    })
    .filter(Boolean)
    .join("; ")

  // Deduplicated union of all personality tags
  const combinedTags = [...new Set(profiles.flatMap(p => p.personality_tags))].join(", ")

  return template
    .replace(/{{child_name}}/g, names)
    .replace(/{{child_age}}/g, ages)
    .replace(/{{prompt_summary}}/g, combinedSummary)
    .replace(/{{appearance_summary}}/g, combinedAppearance)
    .replace(/{{toy_summary}}/g, combinedToys)
    .replace(/{{personality_tags}}/g, combinedTags)
}

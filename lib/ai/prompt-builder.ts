import type { KidProfile, KidAppearance, KidToy } from "@/types"

export function formatAge(age: number, age_months: number): string {
  if (age === 0 && age_months === 0) return "a newborn"
  if (age === 0) return `${age_months} month${age_months === 1 ? "" : "s"} old`
  if (age_months === 0) return `${age} year${age === 1 ? "" : "s"} old`
  return `${age} year${age === 1 ? "" : "s"} and ${age_months} month${age_months === 1 ? "" : "s"} old`
}

function buildAppearanceSummary(appearance: KidAppearance): string {
  const parts: string[] = []
  if (appearance.hair)
    parts.push(`${appearance.hair} hair`)
  else if (appearance.hair_color && appearance.hair_style)
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
  if (!toy.name) return ""
  let result = toy.name
  if (toy.description) result += `, ${toy.description}`
  else if (toy.type) result += ` (a ${toy.type})`
  if (toy.backstory) result += `. ${toy.backstory}`
  return result
}

// Joins a list of names naturally: "Emma", "Emma and Jake", "Emma, Jake, and Sophie"
export function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1]
}

// Builds the prompt_summary string stored on the profile row.
export function buildPromptSummary(
  profile: Pick<KidProfile, "name" | "age" | "age_months" | "gender" | "appearance" | "personality_tags" | "toy">
): string {
  const parts: string[] = []

  if (profile.gender)
    parts.push(`${profile.name} is a ${profile.gender}.`)

  const appearance = buildAppearanceSummary(profile.appearance)
  if (appearance) parts.push(`${profile.name} has ${appearance}.`)

  if (profile.personality_tags.length > 0)
    parts.push(`${profile.name} is ${profile.personality_tags.join(", ")}.`)

  const toy = buildToySummary(profile.toy)
  if (toy) parts.push(`Their favorite toy is ${toy}.`)

  return parts.join(" ")
}

// Builds a prompt for generating a neutral character reference portrait.
export function buildReferenceImagePrompt(profile: KidProfile): string {
  const ageMonths = profile.age_months ?? 0
  const isInfant = profile.age === 0
  const age = formatAge(profile.age, ageMonths)
  const humanGender = profile.gender === "girl" ? "human girl"
    : profile.gender === "boy" ? "human boy"
    : "human child"
  const appearance = buildAppearanceSummary(profile.appearance)

  // Pose and framing matched to developmental stage so the model generates
  // the correct body type rather than defaulting to a standing toddler.
  let frameDesc: string
  let infantExtras = ""
  if (isInfant) {
    infantExtras = ", chubby cheeks, round face, baby proportions"
    if (ageMonths < 3) {
      frameDesc = "Portrait of a newborn baby lying on their back, looking up"
    } else if (ageMonths < 7) {
      frameDesc = "Portrait of a baby sitting with support, facing forward"
    } else {
      frameDesc = "Portrait of a baby sitting up independently, facing forward"
    }
  } else {
    frameDesc = "Full body portrait"
  }

  // "baby, infant" alongside the age string gives the model two strong
  // vocabulary anchors; age numbers alone are weakly interpreted.
  const ageLabel = isInfant ? `${age} old baby, infant` : `${age} old`

  let desc = `${profile.name}, a ${ageLabel} ${humanGender}${infantExtras}`
  if (appearance) desc += ` with ${appearance}`

  const facingClause = isInfant ? "" : " Facing forward,"

  return `${frameDesc} of ${desc}. ${profile.name} is a human child, not an animal.${facingClause} Simple white background, children's picture book character reference, clear and detailed facial features, consistent character design.`
}

// Builds the prompt for generating a profile picture using the character illustration as the
// sole reference image. The toy is described in text to avoid visual feature blending from
// multi-reference inputs.
export function buildProfilePicturePrompt(
  profile: Pick<KidProfile, "name" | "age" | "age_months" | "gender">,
  toy: { name: string; description?: string | null; generic_description?: string | null } | null
): string {
  const name = profile.name
  const pronoun = profile.gender === "girl" ? "her" : profile.gender === "boy" ? "his" : "their"

  if (!toy) {
    return `Children's picture book illustration. @Image1 is ${name}. Portrait of ${name}. ${name}'s appearance must exactly match @Image1. Soft warm cream background. Portrait orientation. Warm and friendly composition. No other characters.`
  }

  const safeDesc = toy.generic_description ?? toy.description
  const toyDesc = safeDesc ? `${toy.name} — ${safeDesc}` : toy.name

  return `Children's picture book illustration. @Image1 is ${name}. Portrait of ${name} with ${pronoun} treasured item, ${toyDesc}. ${name}'s appearance must exactly match @Image1. ${toy.name} is shown held gently or alongside ${name}. Soft warm cream background. Portrait orientation. Warm and friendly composition. No other characters.`
}

// Builds a detailed character description for image prompts when no reference image is available.
// outfits maps character name → outfit string generated by extractStoryVisuals.
export function buildCharacterAnchor(
  profiles: KidProfile[],
  outfits: Record<string, string> = {}
): string {
  const describe = (p: KidProfile) => {
    const age = formatAge(p.age, p.age_months ?? 0)
    const humanGender = p.gender === "girl" ? "human girl"
      : p.gender === "boy" ? "human boy"
      : "human child"
    const appearance = buildAppearanceSummary(p.appearance)
    const safeDesc = p.toy.generic_description ?? p.toy.description
    const toyText = p.toy.name
      ? [p.toy.name, safeDesc].filter(Boolean).join(", ")
      : null
    const outfit = outfits[p.name] ?? ""

    let desc = `${p.name} (${humanGender}, ${age}`
    if (appearance) desc += `, ${appearance}`
    if (outfit) desc += `, ${outfit}`
    desc += ")"
    if (toyText) desc += `. ${p.name}'s toy (a separate stuffed object ${p.name} holds, not part of their body): ${toyText}`
    return desc
  }

  if (profiles.length === 1) return describe(profiles[0])
  return profiles.map(describe).join(". ")
}

// Slim version used when a group reference image is available via Kontext.
// Characters whose IDs are in referenceProfileIds get slim treatment — appearance
// is visible in the reference image. Characters without a reference still get full descriptions.
export function buildCharacterAnchorSlim(
  profiles: KidProfile[],
  outfits: Record<string, string> = {},
  referenceProfileIds: Set<string> = new Set()
): string {
  const describe = (p: KidProfile) => {
    const outfit = outfits[p.name] ?? ""
    const hasReference = referenceProfileIds.has(p.id)

    if (hasReference) {
      // Reference image is the visual authority — trust it completely.
      // Repeating appearance text alongside a reference image creates competing signals.
      const humanGender = p.gender === "girl" ? "human girl"
        : p.gender === "boy" ? "human boy"
        : "human child"
      let desc = `${p.name} (${humanGender})`
      if (outfit) desc += ` wearing ${outfit}`
      return desc
    }

    // Secondary character without a reference image — full description
    const age = formatAge(p.age, p.age_months ?? 0)
    const humanGender = p.gender === "girl" ? "human girl"
      : p.gender === "boy" ? "human boy"
      : "human child"
    const appearance = buildAppearanceSummary(p.appearance)
    const safeDesc = p.toy.generic_description ?? p.toy.description
    const toyText = p.toy.name
      ? [p.toy.name, safeDesc].filter(Boolean).join(", ")
      : null
    let desc = `${p.name} (${humanGender}, ${age}`
    if (appearance) desc += `, ${appearance}`
    if (outfit) desc += `, ${outfit}`
    desc += ")"
    if (toyText) desc += `. ${p.name}'s toy (a separate stuffed object, not part of their body): ${toyText}`
    return desc
  }

  if (profiles.length === 1) return describe(profiles[0])
  return profiles.map(describe).join("; ")
}

function buildToyObjectDescription(toy: KidToy): {
  objectPhrase: string
  posePhrase: string
} {
  const safeDescription = toy.generic_description ?? toy.description
  const combined = `${toy.name} ${safeDescription ?? ""}`.toLowerCase()

  if (/tiara|crown|wand|hat|cape|mask|glasses|bracelet|necklace|ring|bow|headband/.test(combined)) {
    return {
      objectPhrase: `a single ${toy.name} accessory object`,
      posePhrase: "displayed alone, floating centered on a plain white background, not worn by or placed on any character or animal",
    }
  }

  if (/game|console|controller|device|tablet|phone|remote/.test(combined)) {
    return {
      objectPhrase: `a single ${toy.name} handheld object`,
      posePhrase: "displayed alone on a plain white background, no hands holding it, no character present",
    }
  }

  if (/ball|frisbee|bat|racket/.test(combined)) {
    return {
      objectPhrase: `a single ${toy.name} toy object`,
      posePhrase: "displayed alone on a plain white background, no character present",
    }
  }

  if (/blanket|lovey|cloth|fabric|stuffed cloth/.test(combined)) {
    return {
      objectPhrase: `a single ${toy.name} comfort object`,
      posePhrase: "displayed alone, softly folded or laid flat on a plain white background, no character present",
    }
  }

  return {
    objectPhrase: `a single ${toy.name} stuffed plushie toy`,
    posePhrase: "displayed alone, sitting upright on a plain white background, no child or person present",
  }
}

export function buildToyIllustrationPrompt(toy: KidToy): string {
  const { objectPhrase, posePhrase } = buildToyObjectDescription(toy)
  const safeDescription = toy.generic_description ?? toy.description
  const descriptionClause = safeDescription
    ? ` ${safeDescription}.`
    : ""

  return `${objectPhrase}.${descriptionClause} ${posePhrase}. Children's picture book illustration style, simple, clean, detailed. Plain white background. No characters, no animals, no hands, no people.`
}

// Builds a prompt for generating an isolated character reference portrait for story characters.
export function buildStoryCharacterReferencePrompt(character: { name: string; description: string }): string {
  return `Full body portrait of ${character.name}, ${character.description}. Simple white background, children's picture book character reference, clear and detailed, consistent character design. Single character only, no other characters present.`
}

// Fills template placeholders for a single profile
export function fillPromptTemplate(template: string, profile: KidProfile): string {
  const appearanceSummary = buildAppearanceSummary(profile.appearance)
  const toySummary = buildToySummary(profile.toy)
  const ageStr = formatAge(profile.age, profile.age_months ?? 0)

  return template
    .replace(/{{child_name}}/g, profile.name)
    .replace(/{{child_age}}/g, ageStr)
    .replace(/{{child_gender}}/g, profile.gender ?? "")
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
  const ages = joinNames(profiles.map(p => formatAge(p.age, p.age_months ?? 0)))

  const combinedSummary = profiles
    .map(p => {
      const age = formatAge(p.age, p.age_months ?? 0)
      return `${p.name} (${age}): ${p.prompt_summary}`
    })
    .join(" ")

  const combinedAppearance = profiles
    .map(p => {
      const a = buildAppearanceSummary(p.appearance)
      return a ? `${p.name} has ${a}` : ""
    })
    .filter(Boolean)
    .join("; ")

  const combinedToys = profiles
    .map(p => {
      const t = buildToySummary(p.toy)
      return t ? `${p.name}'s favorite toy is ${t}` : ""
    })
    .filter(Boolean)
    .join("; ")

  const combinedTags = [...new Set(profiles.flatMap(p => p.personality_tags))].join(", ")

  return template
    .replace(/{{child_name}}/g, names)
    .replace(/{{child_age}}/g, ages)
    .replace(/{{child_gender}}/g, profiles.map(p => p.gender ?? "").filter(Boolean).join(", "))
    .replace(/{{prompt_summary}}/g, combinedSummary)
    .replace(/{{appearance_summary}}/g, combinedAppearance)
    .replace(/{{toy_summary}}/g, combinedToys)
    .replace(/{{personality_tags}}/g, combinedTags)
}

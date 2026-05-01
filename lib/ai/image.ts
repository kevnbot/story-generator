import { buildReferenceImagePrompt } from "@/lib/ai/prompt-builder"
import type { KidProfile } from "@/types"

// Applied to every image generation call to prevent character/toy conflation
const NEGATIVE_PROMPT = "animal features on children, animal ears on children, animal tails on children, fur on human characters, chipmunk features on child, cat features on child, dog features on child, child as animal, animal hybrid child, whiskers on human, child with tail"

async function falPost(model: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

export async function generateProfileReferenceImage(profile: KidProfile): Promise<string | null> {
  if (!process.env.FAL_KEY) return null

  const prompt = buildReferenceImagePrompt(profile)
  const response = await falPost("fal-ai/flux/dev", {
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    image_size: "portrait_4_3",
    num_inference_steps: 40,
    guidance_scale: 7.0,
    num_images: 1,
  })

  if (!response.ok) {
    console.error("fal.ai reference image error:", await response.text())
    return null
  }

  const data = await response.json()
  return data.images?.[0]?.url ?? null
}

// Builds a combined reference image showing all story characters together.
// For a single profile: returns that profile's reference URL directly.
// For multiple profiles: chains Kontext calls — starts with the first profile's reference
// image and iteratively adds each additional character, producing one group reference.
// This group image is then used as the Kontext anchor for all story page images.
export async function generateGroupReferenceImage(
  profiles: KidProfile[],
  outfits: Record<string, string> = {}
): Promise<string | null> {
  if (!process.env.FAL_KEY) return null

  const withRef = profiles.filter(p => p.reference_image_url)
  if (withRef.length === 0) return null
  if (withRef.length === 1) return withRef[0].reference_image_url

  let currentImageUrl = withRef[0].reference_image_url!

  for (let i = 1; i < withRef.length; i++) {
    const p = withRef[i]
    const humanGender = p.gender === "girl" ? "human girl"
      : p.gender === "boy" ? "human boy"
      : "human child"

    const appearanceParts: string[] = []
    if (p.appearance?.skin_tone) appearanceParts.push(`${p.appearance.skin_tone} skin`)
    if (p.appearance?.hair) appearanceParts.push(`${p.appearance.hair} hair`)
    else if (p.appearance?.hair_color) appearanceParts.push(`${p.appearance.hair_color} hair`)
    if (p.appearance?.eye_color) appearanceParts.push(`${p.appearance.eye_color} eyes`)
    const appearanceStr = appearanceParts.length > 0 ? ` with ${appearanceParts.join(", ")}` : ""
    const outfit = outfits[p.name] ? `, wearing ${outfits[p.name]}` : ""
    const existingNames = withRef.slice(0, i).map(q => q.name).join(" and ")

    const prompt = `Add ${p.name}, a ${humanGender}${appearanceStr}${outfit}, standing next to ${existingNames}. ${p.name} is a human child, not an animal. Keep all existing characters exactly as they appear. Simple white background, children's picture book character reference sheet, all characters fully visible.`

    const response = await falPost("fal-ai/flux-pro/kontext", {
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      image_url: currentImageUrl,
      image_size: "landscape_4_3",
      num_inference_steps: 28,
      guidance_scale: 7.5,
      num_images: 1,
    })

    if (response.ok) {
      const data = await response.json()
      const url = data.images?.[0]?.url
      if (url) currentImageUrl = url
    } else {
      console.error(`fal.ai group reference error adding ${p.name}:`, await response.text().catch(() => ""))
    }
  }

  return currentImageUrl
}

// Converts a reference image into the target art style while preserving character
// appearances. Called once per story before page generation so the Kontext anchor
// is already in the correct style — Kontext then carries it through every page.
export async function applyArtStyleToReference(
  referenceUrl: string,
  styleDescription: string
): Promise<string> {
  if (!process.env.FAL_KEY) return referenceUrl

  const response = await falPost("fal-ai/flux-pro/kontext", {
    prompt: `${styleDescription}. Maintain all character identities, proportions, and positions exactly as shown. Apply only the artistic rendering style — do not change who is in the image or how they are posed.`,
    image_url: referenceUrl,
    image_size: "landscape_4_3",
    num_inference_steps: 28,
    guidance_scale: 8.0,
    num_images: 1,
  })

  if (response.ok) {
    const data = await response.json()
    const url = data.images?.[0]?.url
    if (url) return url
  }

  console.error("applyArtStyleToReference: style transfer failed, using original reference")
  return referenceUrl
}

// Uses FLUX Kontext when a reference image is available for character consistency,
// falls back to standard FLUX/dev otherwise.
export async function generateStoryImageWithReference(
  prompt: string,
  referenceImageUrl: string | null | undefined,
  seed?: number
): Promise<string | null> {
  if (!process.env.FAL_KEY) {
    console.warn("FAL_KEY not set — skipping image generation")
    return null
  }

  if (referenceImageUrl) {
    const response = await falPost("fal-ai/flux-pro/kontext", {
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      image_url: referenceImageUrl,
      image_size: "landscape_4_3",
      num_inference_steps: 28,
      guidance_scale: 7.5,
      num_images: 1,
    })

    if (response.ok) {
      const data = await response.json()
      const url = data.images?.[0]?.url ?? null
      if (url) return url
    }

    console.error("fal.ai kontext error, falling back to standard generation:", await response.text().catch(() => ""))
  }

  // Fallback: standard FLUX/dev without reference
  const response = await falPost("fal-ai/flux/dev", {
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    image_size: "landscape_4_3",
    num_inference_steps: 28,
    guidance_scale: 7.0,
    num_images: 1,
    ...(seed !== undefined ? { seed } : {}),
  })

  if (!response.ok) {
    console.error("fal.ai error:", await response.text())
    return null
  }

  const data = await response.json()
  return data.images?.[0]?.url ?? null
}

export async function generateStoryImage(prompt: string): Promise<string | null> {
  return generateStoryImageWithReference(prompt, null)
}

import * as Sentry from "@sentry/nextjs"
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
    Sentry.logger.error("fal.ai reference image generation failed", {
      provider: "fal.ai",
      model: "fal-ai/flux/dev",
      status_code: response.status,
    })
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
      Sentry.logger.error("fal.ai group reference image update failed", {
        provider: "fal.ai",
        model: "fal-ai/flux-pro/kontext",
        status_code: response.status,
        profile_index: i,
        profile_count: withRef.length,
      })
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

  Sentry.logger.warn("fal.ai reference art style transfer failed; using original reference", {
    provider: "fal.ai",
    model: "fal-ai/flux-pro/kontext",
    status_code: response.status,
  })
  return referenceUrl
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function falPostWithRetry(
  model: string,
  body: Record<string, unknown>,
  maxAttempts = 3,
  delayMs = 2000
): Promise<{ ok: boolean; data: Record<string, unknown> | null; errorText: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await falPost(model, body)
    if (response.ok) {
      const data = await response.json()
      return { ok: true, data, errorText: "" }
    }
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    const isRetryable = response.status === 429 || response.status >= 500
    if (!isRetryable || attempt === maxAttempts) {
      return { ok: false, data: null, errorText }
    }
    Sentry.logger.warn("fal.ai image generation attempt failed; retrying", {
      provider: "fal.ai",
      model,
      attempt,
      max_attempts: maxAttempts,
      status_code: response.status,
      retry_delay_ms: delayMs,
    })
    await sleep(delayMs)
  }
  return { ok: false, data: null, errorText: "max retries exceeded" }
}

// Uses FLUX Kontext when a reference image is available for character consistency,
// falls back to standard FLUX/dev otherwise.
export async function generateStoryImageWithReference(
  prompt: string,
  referenceImageUrl: string | null | undefined,
  seed?: number
): Promise<string | null> {
  if (!process.env.FAL_KEY) {
    Sentry.logger.warn("fal.ai key missing; skipping image generation", {
      provider: "fal.ai",
    })
    return null
  }

  if (referenceImageUrl) {
    const { ok, data, errorText } = await falPostWithRetry("fal-ai/flux-pro/kontext", {
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      image_url: referenceImageUrl,
      image_size: "landscape_4_3",
      num_inference_steps: 28,
      guidance_scale: 7.5,
      num_images: 1,
    })

    if (ok) {
      const url = (data as Record<string, unknown> & { images?: { url: string }[] })?.images?.[0]?.url ?? null
      if (url) return url
    } else {
      Sentry.logger.warn("fal.ai Kontext image generation failed; falling back to standard generation", {
        provider: "fal.ai",
        model: "fal-ai/flux-pro/kontext",
        error_length: errorText.length,
      })
    }
  }

  // Fallback: standard FLUX/dev without reference
  const { ok, data, errorText } = await falPostWithRetry("fal-ai/flux/dev", {
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    image_size: "landscape_4_3",
    num_inference_steps: 28,
    guidance_scale: 7.0,
    num_images: 1,
    ...(seed !== undefined ? { seed } : {}),
  })

  if (!ok) {
    Sentry.logger.error("fal.ai standard image generation failed", {
      provider: "fal.ai",
      model: "fal-ai/flux/dev",
      error_length: errorText.length,
    })
    return null
  }

  return (data as Record<string, unknown> & { images?: { url: string }[] })?.images?.[0]?.url ?? null
}

export async function generateStoryImage(prompt: string): Promise<string | null> {
  return generateStoryImageWithReference(prompt, null)
}

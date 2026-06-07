import { logger } from "@/lib/logger"
import { buildReferenceImagePrompt } from "@/lib/ai/prompt-builder"
import { NEGATIVE_PROMPT, buildReferenceStylePrompt } from "@/lib/ai/image-prompt"
import type { KidProfile } from "@/types"
import type { ImageProvider, ImageGenerationOptions, ImageSize } from "./types"

export { NEGATIVE_PROMPT }

const FAL_SIZE_MAP: Record<ImageSize, string> = {
  landscape_4_3: "landscape_4_3",
  portrait_4_3: "portrait_4_3",
  square: "square_hd",
}

// ─── Private HTTP helpers ──────────────────────────────────────────────────────

async function falPost(model: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function falPostWithRetry(
  model: string,
  body: Record<string, unknown>,
  maxAttempts = 4,
  baseDelayMs = 3000
): Promise<{ ok: boolean; data: Record<string, unknown> | null; errorText: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await falPost(model, body)
    if (response.ok) {
      const data = await response.json()
      return { ok: true, data, errorText: "" }
    }
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    const isRetryable = response.status === 429 || response.status >= 500
    if (!isRetryable) {
      logger.warn("fal.ai image generation non-retryable error", {
        provider: "fal.ai",
        model,
        status_code: response.status,
        error: errorText.slice(0, 500),
      })
      return { ok: false, data: null, errorText }
    }
    if (attempt === maxAttempts) {
      return { ok: false, data: null, errorText }
    }
    const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000
    logger.warn("fal.ai image generation attempt failed; retrying", {
      provider: "fal.ai",
      model,
      attempt,
      max_attempts: maxAttempts,
      status_code: response.status,
      error: errorText.slice(0, 500),
      retry_delay_ms: Math.round(delayMs),
    })
    await sleep(delayMs)
  }
  return { ok: false, data: null, errorText: "max retries exceeded" }
}

function extractUrl(data: Record<string, unknown> | null): string | null {
  return (data as { images?: { url: string }[] } | null)?.images?.[0]?.url ?? null
}

// ─── ImageProvider implementation ─────────────────────────────────────────────

export const falProvider: ImageProvider = {
  id: "fal",
  label: "fal.ai",
  supportsReferenceImages: true,

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<string | null> {
    if (!process.env.FAL_KEY) {
      logger.warn("fal.ai key missing; skipping image generation", { provider: "fal.ai" })
      return null
    }

    const {
      referenceImageUrl,
      seed,
      size = "landscape_4_3",
      negativePrompt = NEGATIVE_PROMPT,
    } = options
    const falSize = FAL_SIZE_MAP[size]

    if (referenceImageUrl) {
      const { ok, data, errorText } = await falPostWithRetry("fal-ai/flux-pro/kontext", {
        prompt,
        negative_prompt: negativePrompt,
        image_url: referenceImageUrl,
        image_size: falSize,
        num_inference_steps: 28,
        guidance_scale: 7.5,
        num_images: 1,
      })
      if (ok) {
        const url = extractUrl(data)
        if (url) return url
      } else {
        logger.warn("fal.ai Kontext image generation failed; falling back to standard generation", {
          provider: "fal.ai",
          model: "fal-ai/flux-pro/kontext",
          error: errorText.slice(0, 500),
        })
      }
    }

    // Fallback: standard FLUX/dev without reference image
    const { ok, data, errorText } = await falPostWithRetry("fal-ai/flux/dev", {
      prompt,
      negative_prompt: negativePrompt,
      image_size: falSize,
      num_inference_steps: 28,
      guidance_scale: 7.0,
      num_images: 1,
      ...(seed !== undefined ? { seed } : {}),
    })

    if (!ok) {
      logger.error("fal.ai standard image generation failed", {
        provider: "fal.ai",
        model: "fal-ai/flux/dev",
        error: errorText.slice(0, 500),
      })
      return null
    }

    return extractUrl(data)
  },
}

// ─── fal.ai-specific utilities (profile & style management) ───────────────────

export async function generateProfileReferenceImage(profile: KidProfile): Promise<string | null> {
  if (!process.env.FAL_KEY) return null

  const prompt = buildReferenceImagePrompt(profile)
  const isInfant = profile.age === 0
  const negativePrompt = isInfant
    ? `${NEGATIVE_PROMPT}, standing child, walking child, toddler standing upright, older child`
    : NEGATIVE_PROMPT
  const guidanceScale = isInfant ? 8.5 : 7.0

  const response = await falPost("fal-ai/flux/dev", {
    prompt,
    negative_prompt: negativePrompt,
    image_size: "portrait_4_3",
    num_inference_steps: 40,
    guidance_scale: guidanceScale,
    num_images: 1,
  })

  if (!response.ok) {
    logger.error("fal.ai reference image generation failed", {
      provider: "fal.ai",
      model: "fal-ai/flux/dev",
      status_code: response.status,
    })
    return null
  }

  const data = await response.json()
  return data.images?.[0]?.url ?? null
}

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
      logger.error("fal.ai group reference image update failed", {
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

export async function applyArtStyleToReference(
  referenceUrl: string,
  styleDescription: string
): Promise<string> {
  if (!process.env.FAL_KEY) return referenceUrl

  const response = await falPost("fal-ai/flux-pro/kontext", {
    prompt: buildReferenceStylePrompt(styleDescription),
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

  logger.warn("fal.ai reference art style transfer failed; using original reference", {
    provider: "fal.ai",
    model: "fal-ai/flux-pro/kontext",
    status_code: response.status,
  })
  return referenceUrl
}

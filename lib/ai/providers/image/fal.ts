import { logger } from "@/lib/logger"
import { IMAGE_PROVIDER_METADATA, type ImageProviderId, type ImageProviderMetadata, type CharacterReference } from "./options"
import type { ImageProvider, ImageGenerationOptions, ImageResult } from "./types"
import {
  ASPECT_RATIO_MAP,
  detectBlackImage,
  resolveReferenceImageUrls,
  validateReferenceCount,
} from "./utils"

type FalProviderId = Extract<ImageProviderId, "fal-kontext" | "fal-kontext-multi" | "fal-nano-banana-2" | "fal-kling-o1">

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

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

// HTTP-level retry handles 429 and 5xx; separate from result-level retry below.
async function falPostWithRetry(
  model: string,
  body: Record<string, unknown>,
  maxAttempts = 4,
  baseDelayMs = 3000,
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
        provider: "fal",
        model,
        status_code: response.status,
        error: errorText.slice(0, 500),
      })
      return { ok: false, data: null, errorText }
    }
    if (attempt === maxAttempts) return { ok: false, data: null, errorText }
    const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000
    logger.warn("fal.ai image generation HTTP retry", {
      provider: "fal",
      model,
      attempt,
      max_attempts: maxAttempts,
      status_code: response.status,
      retry_delay_ms: Math.round(delayMs),
    })
    await sleep(delayMs)
  }
  return { ok: false, data: null, errorText: "max retries exceeded" }
}

function extractUrl(data: Record<string, unknown> | null): string | null {
  return (data as { images?: { url: string }[] } | null)?.images?.[0]?.url ?? null
}

// ─── Reference helpers ────────────────────────────────────────────────────────

export function resolveCharacterReferences(refs: CharacterReference[]): {
  urls: string[]
  labels: string[]
} {
  const urls = refs.map(ref => ref.imageUrl)
  const labels = refs.map(ref => {
    if (ref.role === "profile") {
      return ref.name
    }
    if (ref.role === "toy") {
      const base = ref.boundTo
        ? `${ref.name}, ${ref.boundTo}'s treasured item`
        : ref.name
      return ref.description ? `${base} — ${ref.description}` : base
    }
    // role === "story_character"
    return ref.description ? `${ref.name} — ${ref.description}` : ref.name
  })
  return { urls, labels }
}

export function buildKlingReferencePrompt(prompt: string, labels: string[]): string {
  if (labels.length === 0 || /@Image(?:\d+)?/.test(prompt)) return prompt

  const referenceLines = labels.map((label, index) => {
    const imageToken = labels.length === 1 ? "@Image" : `@Image${index + 1}`
    return `${imageToken} is ${label}.`
  })

  return [
    referenceLines.join(" "),
    "Preserve each referenced person's identity and use the matching reference image for their appearance.",
    prompt,
  ].join(" ")
}

function validateReferences(
  metadata: ImageProviderMetadata,
  referenceUrls: string[],
): string | null {
  return validateReferenceCount(metadata, referenceUrls, { requireAtLeastOne: true })
}

export function buildFalRequest(
  providerId: FalProviderId,
  prompt: string,
  options: ImageGenerationOptions = {},
): { model: string; body: Record<string, unknown>; referenceImageCount: number } | { error: string; referenceImageCount: number } {
  const metadata = IMAGE_PROVIDER_METADATA[providerId]
  const referenceUrls = resolveReferenceImageUrls(options)
  const referenceError = validateReferences(metadata, referenceUrls)
  if (referenceError) return { error: referenceError, referenceImageCount: referenceUrls.length }

  const size = options.size ?? "landscape_4_3"
  const aspectRatio = ASPECT_RATIO_MAP[size]

  if (providerId === "fal-kontext") {
    return {
      model: metadata.modelId,
      referenceImageCount: referenceUrls.length,
      body: {
        prompt,
        image_url: referenceUrls[0],
        guidance_scale: 3.5,
        num_images: 1,
        output_format: "jpeg",
        safety_tolerance: "2",
        enhance_prompt: false,
        aspect_ratio: aspectRatio,
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
      },
    }
  }

  if (providerId === "fal-kontext-multi") {
    return {
      model: metadata.modelId,
      referenceImageCount: referenceUrls.length,
      body: {
        prompt,
        image_urls: referenceUrls,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: "jpeg",
        safety_tolerance: "2",
        enhance_prompt: false,
        aspect_ratio: aspectRatio,
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
      },
    }
  }

  if (providerId === "fal-nano-banana-2") {
    return {
      model: metadata.modelId,
      referenceImageCount: referenceUrls.length,
      body: {
        prompt,
        image_urls: referenceUrls,
        num_images: 1,
        aspect_ratio: aspectRatio,
        output_format: "png",
        safety_tolerance: "4",
        sync_mode: false,
        resolution: "1K",
        limit_generations: true,
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
      },
    }
  }

  const labels = options.referenceImageLabels?.filter((label) => label.trim()) ?? []
  const promptWithRefs = buildKlingReferencePrompt(prompt, labels.slice(0, referenceUrls.length))

  return {
    model: metadata.modelId,
    referenceImageCount: referenceUrls.length,
    body: {
      prompt: promptWithRefs,
      image_urls: referenceUrls,
      resolution: "1K",
      num_images: 1,
      aspect_ratio: aspectRatio,
      output_format: "png",
      sync_mode: false,
    },
  }
}

// ─── Single generation attempt ────────────────────────────────────────────────

async function singleAttempt(
  providerId: FalProviderId,
  prompt: string,
  options: ImageGenerationOptions,
): Promise<{ url: string | null; error: string | null; modelId: string; referenceImageCount: number }> {
  const request = buildFalRequest(providerId, prompt, options)
  if ("error" in request) {
    return {
      url: null,
      error: request.error,
      modelId: IMAGE_PROVIDER_METADATA[providerId].modelId,
      referenceImageCount: request.referenceImageCount,
    }
  }

  const { ok, data, errorText } = await falPostWithRetry(request.model, request.body)
  if (!ok) {
    logger.error("fal.ai image generation failed", {
      provider: providerId,
      model: request.model,
      error: errorText.slice(0, 500),
    })
    return { url: null, error: errorText, modelId: request.model, referenceImageCount: request.referenceImageCount }
  }

  return {
    url: extractUrl(data),
    error: null,
    modelId: request.model,
    referenceImageCount: request.referenceImageCount,
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [2000, 4000]

function createFalProvider(providerId: FalProviderId): ImageProvider {
  const metadata = IMAGE_PROVIDER_METADATA[providerId]

  return {
    ...metadata,

    async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<ImageResult> {
      const referenceImageCount = resolveReferenceImageUrls(options).length
      if (!process.env.FAL_KEY) {
        logger.warn("fal.ai key missing; skipping image generation", { provider: providerId })
        return {
          url: null,
          error: "FAL_KEY not configured",
          isBlackImage: false,
          attempts: 0,
          modelId: metadata.modelId,
          referenceImageCount,
        }
      }

      let lastResult: ImageResult = {
        url: null,
        error: null,
        isBlackImage: false,
        attempts: 0,
        modelId: metadata.modelId,
        referenceImageCount,
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        const { url, error, modelId, referenceImageCount: refsUsed } = await singleAttempt(providerId, prompt, options)
        const isBlackImage = url !== null ? await detectBlackImage(url) : false
        lastResult = { url, error, isBlackImage, attempts: attempt, modelId, referenceImageCount: refsUsed }

        if (url && !isBlackImage) return lastResult

        if (attempt < 3) {
          const delay = RETRY_DELAYS_MS[attempt - 1]
          logger.warn("fal.ai image result retry scheduled", {
            provider: providerId,
            attempt,
            reason: url === null ? "null_url" : "black_image",
            retry_delay_ms: delay,
          })
          await sleep(delay)
        }
      }

      return lastResult
    },
  }
}

export const falKontextProvider = createFalProvider("fal-kontext")
export const falKontextMultiProvider = createFalProvider("fal-kontext-multi")
export const falNanoBanana2Provider = createFalProvider("fal-nano-banana-2")
export const falKlingO1Provider = createFalProvider("fal-kling-o1")

// Compatibility export for older internal imports. New code should use the
// model-level provider ids exposed by the registry.
export const falProvider = falKontextMultiProvider

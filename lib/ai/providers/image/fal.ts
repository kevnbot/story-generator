import * as Sentry from "@sentry/nextjs"
import { NEGATIVE_PROMPT } from "@/lib/ai/image-prompt"
import type { ImageProvider, ImageGenerationOptions, ImageResult } from "./types"

type ImageSize = NonNullable<ImageGenerationOptions["size"]>

const FAL_SIZE_MAP: Record<ImageSize, string> = {
  landscape_4_3: "landscape_4_3",
  portrait_4_3:  "portrait_4_3",
  square:        "square_hd",
}

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
      Sentry.logger.warn("fal.ai image generation non-retryable error", {
        provider: "fal",
        model,
        status_code: response.status,
        error: errorText.slice(0, 500),
      })
      return { ok: false, data: null, errorText }
    }
    if (attempt === maxAttempts) return { ok: false, data: null, errorText }
    const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000
    Sentry.logger.warn("fal.ai image generation HTTP retry", {
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

// ─── Black image detection ────────────────────────────────────────────────────

// Fetches image headers and checks content-length.
// Returns true if the image is suspiciously small (likely all-black output).
// A missing content-length header is treated as OK (chunked / CDN streaming).
async function detectBlackImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" })
    const cl = res.headers.get("content-length")
    if (cl !== null && parseInt(cl, 10) < 5000) return true
  } catch {
    // Network error on HEAD — don't flag as black image
  }
  return false
}

// ─── Single generation attempt ────────────────────────────────────────────────

// One full try: Kontext if a reference image is available, FLUX/dev otherwise.
async function singleAttempt(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<{ url: string | null; error: string | null }> {
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
      if (url) return { url, error: null }
    }
    Sentry.logger.warn("fal.ai Kontext generation failed; falling back to FLUX/dev", {
      provider: "fal",
      model: "fal-ai/flux-pro/kontext",
      error: errorText.slice(0, 500),
    })
  }

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
    Sentry.logger.error("fal.ai FLUX/dev generation failed", {
      provider: "fal",
      model: "fal-ai/flux/dev",
      error: errorText.slice(0, 500),
    })
    return { url: null, error: errorText }
  }

  return { url: extractUrl(data), error: null }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [2000, 4000]

export const falProvider: ImageProvider = {
  id: "fal",
  label: "fal.ai",
  supportsReferenceImages: true,

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<ImageResult> {
    if (!process.env.FAL_KEY) {
      Sentry.logger.warn("fal.ai key missing; skipping image generation", { provider: "fal" })
      return { url: null, error: "FAL_KEY not configured", isBlackImage: false, attempts: 0 }
    }

    let lastResult: ImageResult = { url: null, error: null, isBlackImage: false, attempts: 0 }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { url, error } = await singleAttempt(prompt, options)
      const isBlackImage = url !== null ? await detectBlackImage(url) : false
      lastResult = { url, error, isBlackImage, attempts: attempt }

      if (url && !isBlackImage) return lastResult

      if (attempt < 3) {
        const delay = RETRY_DELAYS_MS[attempt - 1]
        Sentry.logger.warn("fal.ai image result retry scheduled", {
          provider: "fal",
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

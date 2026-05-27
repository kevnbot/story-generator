import * as Sentry from "@sentry/nextjs"
import type { ImageProvider, ImageGenerationOptions, ImageResult } from "./types"

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// ─── Black image detection ────────────────────────────────────────────────────

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

async function singleAttempt(
  prompt: string,
): Promise<{ url: string | null; error: string | null }> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024",
      output_format: "url",
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    Sentry.logger.error("OpenAI image generation failed", {
      provider: "openai",
      model: "gpt-image-1",
      status_code: response.status,
      error: errorText.slice(0, 500),
    })
    return { url: null, error: errorText }
  }

  const data = await response.json()
  const url: string | null = data.data?.[0]?.url ?? null
  return { url, error: url ? null : "no URL in response" }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [2000, 4000]

export const openaiProvider: ImageProvider = {
  id: "openai",
  label: "OpenAI",
  supportsReferenceImages: false,

  async generateImage(prompt: string, _options: ImageGenerationOptions = {}): Promise<ImageResult> {
    if (!process.env.OPENAI_API_KEY) {
      Sentry.logger.error("OpenAI API key missing; skipping image generation", { provider: "openai" })
      return { url: null, error: "OPENAI_API_KEY not configured", isBlackImage: false, attempts: 0 }
    }

    let lastResult: ImageResult = { url: null, error: null, isBlackImage: false, attempts: 0 }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { url, error } = await singleAttempt(prompt)
      const isBlackImage = url !== null ? await detectBlackImage(url) : false
      lastResult = { url, error, isBlackImage, attempts: attempt }

      if (url && !isBlackImage) return lastResult

      if (attempt < 3) {
        const delay = RETRY_DELAYS_MS[attempt - 1]
        Sentry.logger.warn("OpenAI image result retry scheduled", {
          provider: "openai",
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

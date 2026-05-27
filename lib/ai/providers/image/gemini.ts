import * as Sentry from "@sentry/nextjs"
import type { ImageProvider, ImageGenerationOptions, ImageResult } from "./types"

// Imagen 3 returns base64-encoded bytes rather than a hosted URL.
// generateImage wraps the result as a data URI so callers receive a consistent
// string format. Callers writing to Supabase Storage must handle the data: scheme
// separately — Node's fetch does not resolve data URIs.

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// ─── Black image detection ────────────────────────────────────────────────────

// For data URIs, estimate raw byte size from base64 length (4 chars ≈ 3 bytes).
function detectBlackImageDataUri(dataUri: string): boolean {
  const base64 = dataUri.split(",")[1] ?? ""
  const estimatedBytes = Math.floor(base64.length * 0.75)
  return estimatedBytes < 5000
}

async function detectBlackImage(url: string): Promise<boolean> {
  if (url.startsWith("data:")) return detectBlackImageDataUri(url)
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
  let response: Response
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // x-goog-api-key keeps the key out of the URL and request logs
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          prompt: { text: prompt },
          sampleCount: 1,
          aspectRatio: "4:3",
        }),
      }
    )
  } catch (err) {
    const error = String(err).slice(0, 500)
    Sentry.logger.error("Gemini image generation network error", {
      provider: "gemini",
      model: "imagen-3.0-generate-001",
      error,
    })
    return { url: null, error }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    Sentry.logger.error("Gemini image generation failed", {
      provider: "gemini",
      model: "imagen-3.0-generate-001",
      status_code: response.status,
      error: errorText.slice(0, 500),
    })
    return { url: null, error: errorText }
  }

  const data = await response.json()
  const prediction = data.predictions?.[0]

  if (!prediction?.bytesBase64Encoded || !prediction?.mimeType) {
    Sentry.logger.error("Gemini image generation returned unexpected response shape", {
      provider: "gemini",
      model: "imagen-3.0-generate-001",
    })
    return { url: null, error: "unexpected response shape" }
  }

  const url = `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`
  return { url, error: null }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [2000, 4000]

export const geminiProvider: ImageProvider = {
  id: "gemini",
  label: "Google Imagen 3",
  supportsReferenceImages: false,

  async generateImage(prompt: string, _options: ImageGenerationOptions = {}): Promise<ImageResult> {
    if (!process.env.GEMINI_API_KEY) {
      Sentry.logger.error("Gemini API key missing; skipping image generation", { provider: "gemini" })
      return { url: null, error: "GEMINI_API_KEY not configured", isBlackImage: false, attempts: 0 }
    }

    let lastResult: ImageResult = { url: null, error: null, isBlackImage: false, attempts: 0 }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { url, error } = await singleAttempt(prompt)
      const isBlackImage = url !== null ? await detectBlackImage(url) : false
      lastResult = { url, error, isBlackImage, attempts: attempt }

      if (url && !isBlackImage) return lastResult

      if (attempt < 3) {
        const delay = RETRY_DELAYS_MS[attempt - 1]
        Sentry.logger.warn("Gemini image result retry scheduled", {
          provider: "gemini",
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

import * as Sentry from "@sentry/nextjs"
import type { ImageProvider, ImageGenerationOptions } from "./types"

// Imagen 3 returns base64-encoded bytes rather than a hosted URL.
// generateImage wraps the result as a data URI so it satisfies the
// ImageProvider string return type. Callers that write to Supabase Storage
// (copyRemoteImageToStoragePath) must handle the data: scheme — Node's
// built-in fetch does not resolve data URIs, so the storage helper will
// need a dedicated code path for this provider.

export const geminiProvider: ImageProvider = {
  id: "gemini",
  label: "Google Imagen 3",
  supportsReferenceImages: false,

  async generateImage(prompt: string, _options: ImageGenerationOptions = {}): Promise<string | null> {
    if (!process.env.GEMINI_API_KEY) {
      Sentry.logger.error("Gemini API key missing; skipping image generation", {
        provider: "gemini",
      })
      return null
    }

    let response: Response
    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // x-goog-api-key keeps the key out of the URL and request logs
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            prompt: { text: prompt },
            sampleCount: 1,
            aspectRatio: "4:3",
          }),
        }
      )
    } catch (err) {
      Sentry.logger.error("Gemini image generation network error", {
        provider: "gemini",
        model: "imagen-3.0-generate-001",
        error: String(err).slice(0, 500),
      })
      return null
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`)
      Sentry.logger.error("Gemini image generation failed", {
        provider: "gemini",
        model: "imagen-3.0-generate-001",
        status_code: response.status,
        error: errorText.slice(0, 500),
      })
      return null
    }

    const data = await response.json()
    const prediction = data.predictions?.[0]

    if (!prediction?.bytesBase64Encoded || !prediction?.mimeType) {
      Sentry.logger.error("Gemini image generation returned unexpected response shape", {
        provider: "gemini",
        model: "imagen-3.0-generate-001",
      })
      return null
    }

    return `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`
  },
}

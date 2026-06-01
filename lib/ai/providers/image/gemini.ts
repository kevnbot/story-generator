import * as Sentry from "@sentry/nextjs"
import { dataUriFromBase64 } from "@/lib/image-data"
import { IMAGE_PROVIDER_METADATA } from "./options"
import type { ImageProvider, ImageGenerationOptions, ImageResult } from "./types"
import {
  ASPECT_RATIO_MAP,
  buildNumberedReferencePrompt,
  detectBlackImage,
  getReferenceImageLabels,
  loadReferenceImages,
  resolveReferenceImageUrls,
  validateReferenceCount,
} from "./utils"

const METADATA = IMAGE_PROVIDER_METADATA.gemini
const GEMINI_OUTPUT_MIME_TYPE = "image/png"

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

type GeminiInlineData = {
  data?: string
  mimeType?: string
  mime_type?: string
}

type GeminiPart = {
  text?: string
  inlineData?: GeminiInlineData
  inline_data?: GeminiInlineData
  thought?: boolean
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[]
    }
  }>
}

function extractGeminiImageUrl(data: GeminiResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part.thought) continue
    const inlineData = part.inlineData ?? part.inline_data
    if (inlineData?.data) {
      return dataUriFromBase64(inlineData.data, inlineData.mimeType ?? inlineData.mime_type ?? GEMINI_OUTPUT_MIME_TYPE)
    }
  }
  return null
}

async function singleAttempt(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<{ url: string | null; error: string | null; referenceImageCount: number; statusCode: number | null }> {
  const referenceUrls = resolveReferenceImageUrls(options)
  const referenceError = validateReferenceCount(METADATA, referenceUrls, { requireAtLeastOne: false })
  if (referenceError) return { url: null, error: referenceError, referenceImageCount: referenceUrls.length, statusCode: null }

  const labels = getReferenceImageLabels(options, referenceUrls.length)
  const aspectRatio = ASPECT_RATIO_MAP[options.size ?? "landscape_4_3"]

  let response: Response
  try {
    const references = await loadReferenceImages(referenceUrls)
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${METADATA.modelId}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: buildNumberedReferencePrompt(prompt, labels) },
              ...references.map((reference) => ({
                inline_data: {
                  mime_type: reference.contentType,
                  data: reference.base64,
                },
              })),
            ],
          }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            responseFormat: {
              image: {
                aspectRatio,
                imageSize: "1K",
              },
            },
          },
        }),
      }
    )
  } catch (err) {
    const error = String(err).slice(0, 500)
    Sentry.logger.error("Gemini image generation network error", {
      provider: "gemini",
      model: METADATA.modelId,
      error,
    })
    return { url: null, error, referenceImageCount: referenceUrls.length, statusCode: null }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    Sentry.logger.error("Gemini image generation failed", {
      provider: "gemini",
      model: METADATA.modelId,
      status_code: response.status,
      error: errorText.slice(0, 500),
    })
    return { url: null, error: errorText, referenceImageCount: referenceUrls.length, statusCode: response.status }
  }

  const data = await response.json() as GeminiResponse
  const url = extractGeminiImageUrl(data)
  return {
    url,
    error: url ? null : "no image data in response",
    referenceImageCount: referenceUrls.length,
    statusCode: response.status,
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [2000, 4000]

export const geminiProvider: ImageProvider = {
  ...METADATA,

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<ImageResult> {
    const referenceImageCount = resolveReferenceImageUrls(options).length
    if (!process.env.GEMINI_API_KEY) {
      Sentry.logger.error("Gemini API key missing; skipping image generation", { provider: "gemini" })
      return { url: null, error: "GEMINI_API_KEY not configured", isBlackImage: false, attempts: 0, modelId: METADATA.modelId, referenceImageCount, statusCode: null }
    }

    let lastResult: ImageResult = { url: null, error: null, isBlackImage: false, attempts: 0, modelId: METADATA.modelId, referenceImageCount, statusCode: null }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { url, error, referenceImageCount: refsUsed, statusCode } = await singleAttempt(prompt, options)
      const isBlackImage = url !== null ? await detectBlackImage(url) : false
      lastResult = { url, error, isBlackImage, attempts: attempt, modelId: METADATA.modelId, referenceImageCount: refsUsed, statusCode }

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

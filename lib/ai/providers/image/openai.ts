import { logger } from "@/lib/logger"
import { dataUriFromBase64 } from "@/lib/image-data"
import { IMAGE_PROVIDER_METADATA } from "./options"
import type { ImageProvider, ImageGenerationOptions, ImageResult } from "./types"
import {
  buildNumberedReferencePrompt,
  detectBlackImage,
  getReferenceImageLabels,
  loadReferenceImages,
  resolveReferenceImageUrls,
  validateReferenceCount,
} from "./utils"

const METADATA = IMAGE_PROVIDER_METADATA.openai
const OPENAI_OUTPUT_FORMAT = "png"
const OPENAI_OUTPUT_MIME_TYPE = "image/png"
const OPENAI_SIZE_MAP: Record<NonNullable<ImageGenerationOptions["size"]>, string> = {
  landscape_4_3: "1536x1024",
  portrait_4_3:  "1024x1536",
  square:        "1024x1024",
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string
    url?: string
  }>
}

function extractOpenAiImageUrl(data: OpenAiImageResponse): string | null {
  const item = data.data?.[0]
  if (!item) return null
  if (item.b64_json) return dataUriFromBase64(item.b64_json, OPENAI_OUTPUT_MIME_TYPE)
  return item.url ?? null
}

async function postOpenAiJson(body: Record<string, unknown>): Promise<Response> {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

async function postOpenAiMultipart(form: FormData): Promise<Response> {
  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form,
  })
}

async function singleAttempt(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<{ url: string | null; error: string | null; referenceImageCount: number; statusCode: number | null }> {
  const referenceUrls = resolveReferenceImageUrls(options)
  const referenceError = validateReferenceCount(METADATA, referenceUrls, { requireAtLeastOne: false })
  if (referenceError) return { url: null, error: referenceError, referenceImageCount: referenceUrls.length, statusCode: null }

  const size = OPENAI_SIZE_MAP[options.size ?? "landscape_4_3"]
  const labels = getReferenceImageLabels(options, referenceUrls.length)
  let response: Response

  try {
    if (referenceUrls.length > 0) {
      const references = await loadReferenceImages(referenceUrls)
      const form = new FormData()
      form.append("model", METADATA.modelId)
      form.append("prompt", buildNumberedReferencePrompt(prompt, labels))
      form.append("n", "1")
      form.append("size", size)
      form.append("output_format", OPENAI_OUTPUT_FORMAT)

      references.forEach((reference, index) => {
        form.append(
          "image[]",
          new Blob([reference.bytes], { type: reference.contentType }),
          `reference-${index + 1}.${reference.extension}`,
        )
      })

      response = await postOpenAiMultipart(form)
    } else {
      response = await postOpenAiJson({
        model: METADATA.modelId,
        prompt,
        n: 1,
        size,
        output_format: OPENAI_OUTPUT_FORMAT,
      })
    }
  } catch (err) {
    const error = String(err).slice(0, 500)
    logger.error("OpenAI image generation network error", {
      provider: "openai",
      model: METADATA.modelId,
      error,
    })
    return { url: null, error, referenceImageCount: referenceUrls.length, statusCode: null }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    logger.error("OpenAI image generation failed", {
      provider: "openai",
      model: METADATA.modelId,
      status_code: response.status,
      error: errorText.slice(0, 500),
    })
    return { url: null, error: errorText, referenceImageCount: referenceUrls.length, statusCode: response.status }
  }

  const data = await response.json() as OpenAiImageResponse
  const url = extractOpenAiImageUrl(data)
  return {
    url,
    error: url ? null : "no image data in response",
    referenceImageCount: referenceUrls.length,
    statusCode: response.status,
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [2000, 4000]

export const openaiProvider: ImageProvider = {
  ...METADATA,

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<ImageResult> {
    const referenceImageCount = resolveReferenceImageUrls(options).length
    if (!process.env.OPENAI_API_KEY) {
      logger.error("OpenAI API key missing; skipping image generation", { provider: "openai" })
      return { url: null, error: "OPENAI_API_KEY not configured", isBlackImage: false, attempts: 0, modelId: METADATA.modelId, referenceImageCount, statusCode: null }
    }

    let lastResult: ImageResult = { url: null, error: null, isBlackImage: false, attempts: 0, modelId: METADATA.modelId, referenceImageCount, statusCode: null }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { url, error, referenceImageCount: refsUsed, statusCode } = await singleAttempt(prompt, options)
      const isBlackImage = url !== null ? await detectBlackImage(url) : false
      lastResult = { url, error, isBlackImage, attempts: attempt, modelId: METADATA.modelId, referenceImageCount: refsUsed, statusCode }

      if (url && !isBlackImage) return lastResult

      if (attempt < 3) {
        const delay = RETRY_DELAYS_MS[attempt - 1]
        logger.warn("OpenAI image result retry scheduled", {
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

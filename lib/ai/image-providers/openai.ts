import * as Sentry from "@sentry/nextjs"
import type { ImageProvider, ImageGenerationOptions } from "./types"

export const openaiProvider: ImageProvider = {
  id: "openai",
  label: "OpenAI",
  supportsReferenceImages: false,

  async generateImage(prompt: string, _options: ImageGenerationOptions = {}): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) {
      Sentry.logger.error("OpenAI API key missing; skipping image generation", {
        provider: "openai",
      })
      return null
    }

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
      return null
    }

    const data = await response.json()
    return data.data?.[0]?.url ?? null
  },
}

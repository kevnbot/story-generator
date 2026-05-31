import { openaiProvider as currentOpenAiProvider } from "@/lib/ai/providers/image/openai"
import type { ImageProvider, ImageGenerationOptions } from "./types"

export const openaiProvider: ImageProvider = {
  id: currentOpenAiProvider.id,
  label: currentOpenAiProvider.label,
  supportsReferenceImages: currentOpenAiProvider.supportsReferenceImages,

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<string | null> {
    const result = await currentOpenAiProvider.generateImage(prompt, options)
    return result.url
  },
}

import { geminiProvider as currentGeminiProvider } from "@/lib/ai/providers/image/gemini"
import type { ImageProvider, ImageGenerationOptions } from "./types"

export const geminiProvider: ImageProvider = {
  id: currentGeminiProvider.id,
  label: currentGeminiProvider.label,
  supportsReferenceImages: currentGeminiProvider.supportsReferenceImages,

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<string | null> {
    const result = await currentGeminiProvider.generateImage(prompt, options)
    return result.url
  },
}

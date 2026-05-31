import { falProvider } from "./fal"
import { openaiProvider } from "./openai"
import { geminiProvider } from "./gemini"
import type { ImageProvider } from "./types"

export { falProvider } from "./fal"
export { openaiProvider } from "./openai"
export { geminiProvider } from "./gemini"
export type { ImageProvider, ImageGenerationOptions, ImageSize } from "./types"

export const PROVIDERS: Record<string, ImageProvider> = {
  [falProvider.id]: falProvider,
  [openaiProvider.id]: openaiProvider,
  [geminiProvider.id]: geminiProvider,
}

export function getImageProvider(id: string): ImageProvider {
  return PROVIDERS[id] ?? falProvider
}

export const PROVIDER_OPTIONS: { id: string; label: string }[] = [
  { id: "fal",    label: "fal.ai (FLUX)" },
  { id: "openai", label: "OpenAI (gpt-image-1)" },
  { id: "gemini", label: "Google Gemini 3 Pro Image" },
]

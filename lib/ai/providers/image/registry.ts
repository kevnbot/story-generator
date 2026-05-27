import { falProvider } from "./fal"
import { openaiProvider } from "./openai"
import { geminiProvider } from "./gemini"
import type { ImageProvider } from "./types"

const REGISTRY: Record<string, ImageProvider> = {
  [falProvider.id]:    falProvider,
  [openaiProvider.id]: openaiProvider,
  [geminiProvider.id]: geminiProvider,
}

// Resolves a provider by explicit id, then STORY_IMAGE_PROVIDER env var, then "fal".
export function getImageProvider(id?: string): ImageProvider {
  const resolved = id ?? process.env.STORY_IMAGE_PROVIDER ?? "fal"
  return REGISTRY[resolved] ?? REGISTRY.fal
}

export function listImageProviders(): ImageProvider[] {
  return Object.values(REGISTRY)
}

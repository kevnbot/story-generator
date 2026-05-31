import {
  falKlingO1Provider,
  falKontextMultiProvider,
  falKontextProvider,
  falNanoBanana2Provider,
} from "./fal"
import { openaiProvider } from "./openai"
import { geminiProvider } from "./gemini"
import {
  DEFAULT_IMAGE_PROVIDER_ID,
  getImageProviderMetadata,
  listImageProviderMetadata,
  type ImageProviderId,
} from "./options"
import type { ImageProvider } from "./types"

const REGISTRY: Record<ImageProviderId, ImageProvider> = {
  "fal-kontext":        falKontextProvider,
  "fal-kontext-multi":  falKontextMultiProvider,
  "fal-nano-banana-2":  falNanoBanana2Provider,
  "fal-kling-o1":       falKlingO1Provider,
  openai:               openaiProvider,
  gemini:               geminiProvider,
}

// Resolves a provider by explicit id, then STORY_IMAGE_PROVIDER env var, then the multi-reference fal default.
export function getImageProvider(id?: string): ImageProvider {
  const resolved = getImageProviderMetadata(id ?? process.env.STORY_IMAGE_PROVIDER).id
  return REGISTRY[resolved] ?? REGISTRY[DEFAULT_IMAGE_PROVIDER_ID]
}

export function listImageProviders(): ImageProvider[] {
  return listImageProviderMetadata().map((metadata) => REGISTRY[metadata.id])
}

export function isImageProviderKeyAvailable(id?: string): boolean {
  const provider = getImageProvider(id)
  if (provider.id === "openai") return !!process.env.OPENAI_API_KEY
  if (provider.id === "gemini") return !!process.env.GEMINI_API_KEY
  return !!process.env.FAL_KEY
}

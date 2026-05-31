import type { ImageProviderId, ImageReferenceMode } from "./options"

export interface ImageGenerationOptions {
  referenceImageUrl?: string | null
  referenceImageUrls?: string[] | null
  referenceImageLabels?: string[] | null
  seed?: number
  size?: "landscape_4_3" | "portrait_4_3" | "square"
  negativePrompt?: string
}

export interface ImageProvider {
  id: ImageProviderId
  label: string
  modelId: string
  supportsReferenceImages: boolean
  referenceMode: ImageReferenceMode
  maxReferenceImages: number | null
  supportsSeedControl: boolean
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageResult>
}

export interface ImageResult {
  url: string | null
  error: string | null
  isBlackImage: boolean
  attempts: number
  modelId?: string
  referenceImageCount?: number
}

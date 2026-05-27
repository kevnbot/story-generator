export interface ImageGenerationOptions {
  referenceImageUrl?: string | null
  seed?: number
  size?: "landscape_4_3" | "portrait_4_3" | "square"
  negativePrompt?: string
}

export interface ImageProvider {
  id: string
  label: string
  supportsReferenceImages: boolean
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageResult>
}

export interface ImageResult {
  url: string | null
  error: string | null
  isBlackImage: boolean
  attempts: number
}

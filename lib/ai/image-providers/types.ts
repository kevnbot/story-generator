export type ImageSize = "landscape_4_3" | "portrait_4_3" | "square"

export interface ImageGenerationOptions {
  referenceImageUrl?: string | null
  seed?: number
  size?: ImageSize
  negativePrompt?: string
}

export interface ImageProvider {
  id: string
  label: string
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<string | null>
  supportsReferenceImages: boolean
}

export type ImageReferenceMode = "none" | "single" | "multi"

export type ImageProviderId =
  | "fal-kontext"
  | "fal-kontext-multi"
  | "fal-nano-banana-2"
  | "fal-kling-o1"
  | "openai"
  | "gemini"

export interface ImageProviderMetadata {
  id: ImageProviderId
  label: string
  modelId: string
  referenceMode: ImageReferenceMode
  supportsReferenceImages: boolean
  supportsSeedControl: boolean
  maxReferenceImages: number | null
  contentFilterBehavior: string
  storageHandling: string
  knownLimitations: string
  expectedTime: string
}

export const DEFAULT_IMAGE_PROVIDER_ID: ImageProviderId = "fal-kontext-multi"

export const IMAGE_PROVIDER_METADATA: Record<ImageProviderId, ImageProviderMetadata> = {
  "fal-kontext": {
    id: "fal-kontext",
    label: "FLUX Pro Kontext",
    modelId: "fal-ai/flux-pro/kontext",
    referenceMode: "single",
    supportsReferenceImages: true,
    supportsSeedControl: true,
    maxReferenceImages: 1,
    contentFilterBehavior: "May return failed or flagged images; app retries and uses placeholders",
    storageHandling: "Direct URL copy",
    knownLimitations: "Single reference image only",
    expectedTime: "15-30s per image",
  },
  "fal-kontext-multi": {
    id: "fal-kontext-multi",
    label: "FLUX Pro Kontext Multi",
    modelId: "fal-ai/flux-pro/kontext/multi",
    referenceMode: "multi",
    supportsReferenceImages: true,
    supportsSeedControl: true,
    maxReferenceImages: null,
    contentFilterBehavior: "May return failed or flagged images; app retries and uses placeholders",
    storageHandling: "Direct URL copy",
    knownLimitations: "Experimental multi-image handling; no hard reference max is stated in the docs",
    expectedTime: "15-35s per image",
  },
  "fal-nano-banana-2": {
    id: "fal-nano-banana-2",
    label: "Nano Banana 2 Edit",
    modelId: "fal-ai/nano-banana-2/edit",
    referenceMode: "multi",
    supportsReferenceImages: true,
    supportsSeedControl: true,
    maxReferenceImages: 14,
    contentFilterBehavior: "Provider moderation errors surface as failed generations",
    storageHandling: "Direct URL copy",
    knownLimitations: "Up to 14 reference images; best character consistency is documented for up to 5 people",
    expectedTime: "5-15s per image",
  },
  "fal-kling-o1": {
    id: "fal-kling-o1",
    label: "Kling O1 Image",
    modelId: "fal-ai/kling-image/o1",
    referenceMode: "multi",
    supportsReferenceImages: true,
    supportsSeedControl: false,
    maxReferenceImages: 10,
    contentFilterBehavior: "Provider moderation errors surface as failed generations",
    storageHandling: "Direct URL copy",
    knownLimitations: "Prompts must refer to references as @Image1, @Image2, etc.",
    expectedTime: "20-45s per image",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    modelId: "gpt-image-1",
    referenceMode: "multi",
    supportsReferenceImages: true,
    supportsSeedControl: false,
    maxReferenceImages: 16,
    contentFilterBehavior: "Error response on flag",
    storageHandling: "Base64 data URI copied into storage",
    knownLimitations: "Reference-image edits use base64 output; first input may receive strongest preservation",
    expectedTime: "10-20s per image",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini 3 Pro Image",
    modelId: "gemini-3-pro-image-preview",
    referenceMode: "multi",
    supportsReferenceImages: true,
    supportsSeedControl: false,
    maxReferenceImages: 14,
    contentFilterBehavior: "Error response on flag",
    storageHandling: "Base64 data URI copied into storage",
    knownLimitations: "Best high-fidelity reference handling is documented for up to 5 images, with up to 14 total",
    expectedTime: "20-60s per image",
  },
}

export const IMAGE_PROVIDER_OPTIONS: ImageProviderMetadata[] = [
  IMAGE_PROVIDER_METADATA["fal-kontext"],
  IMAGE_PROVIDER_METADATA["fal-kontext-multi"],
  IMAGE_PROVIDER_METADATA["fal-nano-banana-2"],
  IMAGE_PROVIDER_METADATA["fal-kling-o1"],
  IMAGE_PROVIDER_METADATA.openai,
  IMAGE_PROVIDER_METADATA.gemini,
]

export function listImageProviderMetadata(): ImageProviderMetadata[] {
  return IMAGE_PROVIDER_OPTIONS
}

export function isImageProviderId(value: string | undefined): value is ImageProviderId {
  return !!value && value in IMAGE_PROVIDER_METADATA
}

export function getImageProviderMetadata(id: string | undefined): ImageProviderMetadata {
  if (id === "fal") return IMAGE_PROVIDER_METADATA[DEFAULT_IMAGE_PROVIDER_ID]
  return isImageProviderId(id) ? IMAGE_PROVIDER_METADATA[id] : IMAGE_PROVIDER_METADATA[DEFAULT_IMAGE_PROVIDER_ID]
}

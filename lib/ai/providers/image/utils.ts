import { estimateDataUriBytes, readImageUrl, type ImageBytes } from "@/lib/image-data"
import type { ImageProviderMetadata } from "./options"
import type { ImageGenerationOptions } from "./types"

export type ImageSize = NonNullable<ImageGenerationOptions["size"]>

export const ASPECT_RATIO_MAP: Record<ImageSize, string> = {
  landscape_4_3: "4:3",
  portrait_4_3:  "3:4",
  square:        "1:1",
}

export function resolveReferenceImageUrls(options: ImageGenerationOptions): string[] {
  const ordered = [
    ...(options.referenceImageUrls ?? []),
    ...(options.referenceImageUrl ? [options.referenceImageUrl] : []),
  ]
  const seen = new Set<string>()
  return ordered.filter((url) => {
    const trimmed = url.trim()
    if (!trimmed || seen.has(trimmed)) return false
    seen.add(trimmed)
    return true
  })
}

export function getReferenceImageLabels(options: ImageGenerationOptions, count: number): string[] {
  const labels = options.referenceImageLabels?.map((label) => label.trim()).filter(Boolean) ?? []
  return Array.from({ length: count }, (_, index) => labels[index] ?? `reference image ${index + 1}`)
}

export function validateReferenceCount(
  metadata: ImageProviderMetadata,
  referenceUrls: string[],
  options: { requireAtLeastOne: boolean } = { requireAtLeastOne: true },
): string | null {
  if (metadata.referenceMode === "none") return null
  if (metadata.referenceMode === "single" && referenceUrls.length !== 1) {
    return `${metadata.label} requires exactly one reference image; received ${referenceUrls.length}.`
  }
  if (options.requireAtLeastOne && metadata.referenceMode === "multi" && referenceUrls.length === 0) {
    return `${metadata.label} requires at least one reference image.`
  }
  if (metadata.maxReferenceImages !== null && referenceUrls.length > metadata.maxReferenceImages) {
    return `${metadata.label} supports at most ${metadata.maxReferenceImages} reference images; received ${referenceUrls.length}.`
  }
  return null
}

export function buildNumberedReferencePrompt(prompt: string, labels: string[]): string {
  if (labels.length === 0) return prompt

  const referenceLines = labels.map((label, index) => `Reference image ${index + 1} is ${label}.`)
  return [
    referenceLines.join(" "),
    "Preserve each referenced person's identity and use the matching reference image for their appearance.",
    prompt,
  ].join(" ")
}

export async function loadReferenceImages(referenceUrls: string[]): Promise<ImageBytes[]> {
  return Promise.all(referenceUrls.map((url) => readImageUrl(url)))
}

export async function detectBlackImage(url: string): Promise<boolean> {
  if (url.startsWith("data:")) return estimateDataUriBytes(url) < 5000

  try {
    const res = await fetch(url, { method: "HEAD" })
    const cl = res.headers.get("content-length")
    if (cl !== null && parseInt(cl, 10) < 5000) return true
  } catch {
    // Network error on HEAD - don't flag as black image
  }
  return false
}

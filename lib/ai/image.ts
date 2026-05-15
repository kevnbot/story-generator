import { falProvider, generateProfileReferenceImage, generateGroupReferenceImage, applyArtStyleToReference } from "@/lib/ai/image-providers/fal"

export { generateProfileReferenceImage, generateGroupReferenceImage, applyArtStyleToReference }

export async function generateStoryImageWithReference(
  prompt: string,
  referenceImageUrl: string | null | undefined,
  seed?: number
): Promise<string | null> {
  return falProvider.generateImage(prompt, { referenceImageUrl, seed })
}

export async function generateStoryImage(prompt: string): Promise<string | null> {
  return falProvider.generateImage(prompt)
}

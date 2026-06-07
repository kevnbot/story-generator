import { falProvider, generateProfileReferenceImage, generateGroupReferenceImage, applyArtStyleToReference } from "@/lib/ai/image-providers/fal"
import { createServiceClient } from "@/lib/supabase/server"
import { buildProfilePicturePrompt } from "@/lib/ai/prompt-builder"
import { copyRemoteImageToStoragePath } from "@/lib/storage/images"

export { generateProfileReferenceImage, generateGroupReferenceImage, applyArtStyleToReference }

export async function generateAndSaveCombinedReference(
  profileId: string,
  characterImageUrl: string,
  toyDescription: string | null
): Promise<string | null> {
  try {
    const service = createServiceClient()
    const { data } = await service
      .from("kid_profiles")
      .select("name, age, age_months, gender")
      .eq("id", profileId)
      .single()
    if (!data) return null

    const row = data as { name: string; age: number; age_months: number | null; gender?: string | null }
    const toy = toyDescription ? { name: toyDescription } : null
    const prompt = buildProfilePicturePrompt(
      { name: row.name, age: row.age, age_months: row.age_months ?? 0, gender: row.gender ?? undefined },
      toy
    )

    const imageUrl = await falProvider.generateImage(prompt, {
      referenceImageUrl: characterImageUrl,
      size: "portrait_4_3",
    })
    if (!imageUrl) return null

    const storagePath = await copyRemoteImageToStoragePath({
      supabase: service,
      sourceUrl: imageUrl,
      buildPath: (ext) => `profiles/${profileId}/combined-reference.${ext}`,
    })
    if (!storagePath) return null

    await service
      .from("kid_profiles")
      .update({ combined_reference_path: storagePath, combined_reference_url: null, illustration_status: "complete" })
      .eq("id", profileId)

    return storagePath
  } catch (e) {
    console.error("[generateAndSaveCombinedReference]", e)
    return null
  }
}

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

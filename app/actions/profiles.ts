"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { buildPromptSummary, buildToyIllustrationPrompt } from "@/lib/ai/prompt-builder"
import { genericizeToyDescription } from "@/lib/ai/toy-genericizer"
import { generateProfileReferenceImage, generateAndSaveCombinedReference } from "@/lib/ai/image"
import { buildProfileReferenceImagePath, copyRemoteImageToStoragePath, createSignedImageUrlsMap, GENERATED_IMAGES_BUCKET } from "@/lib/storage/images"
import { NEGATIVE_PROMPT } from "@/lib/ai/image-providers/fal"
import { logError } from "@/lib/logger"
import type { KidAppearance, KidToy, KidProfile } from "@/types"

export type CreateProfileResult =
  | { error: string; profileId?: never }
  | { profileId: string; error?: never }

function parseProfileFormData(formData: FormData): {
  error: string | null
  name: string
  age: number
  age_months: number
  gender: string | undefined
  appearance: KidAppearance
  personalityTags: string[]
  toy: KidToy
} {
  const name = formData.get("name") as string
  const ageRaw = formData.get("age") as string
  const ageMonthsRaw = formData.get("age_months") as string
  const gender = (formData.get("gender") as string) || undefined
  const personalityRaw = formData.get("personality_tags") as string
  const toyName = formData.get("toy_name") as string
  const toyDesc = formData.get("toy_description") as string

  if (!name?.trim()) return { error: "Name is required" } as ReturnType<typeof parseProfileFormData>

  const age = ageRaw?.trim() === "" ? 0 : parseInt(ageRaw, 10)
  if (isNaN(age) || age < 0 || age > 17)
    return { error: "Age must be between 0 and 17" } as ReturnType<typeof parseProfileFormData>

  const age_months = parseInt(ageMonthsRaw, 10) || 0
  if (age_months < 0 || age_months > 11)
    return { error: "Months must be between 0 and 11" } as ReturnType<typeof parseProfileFormData>

  const appearance: KidAppearance = {
    hair: (formData.get("hair") as string) || undefined,
    eye_color: (formData.get("eye_color") as string) || undefined,
    skin_tone: (formData.get("skin_tone") as string) || undefined,
  }

  const personalityTags = personalityRaw
    ? [personalityRaw.trim()].filter(Boolean)
    : []

  const toy: KidToy = {
    name: toyName?.trim() || "their favorite toy",
    description: toyDesc?.trim() || undefined,
  }

  return { error: null, name: name.trim(), age, age_months, gender, appearance, personalityTags, toy }
}

export async function createProfile(
  prevState: CreateProfileResult | null,
  formData: FormData
): Promise<CreateProfileResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const parsed = parseProfileFormData(formData)
    if (parsed.error) return { error: parsed.error }
    const { name, age, age_months, gender, appearance, personalityTags, toy } = parsed

    if (toy.name && toy.name !== "their favorite toy") {
      const genericDesc = await genericizeToyDescription(toy.name, toy.description)
      if (genericDesc) {
        toy.generic_description = genericDesc
      }
    }

    const promptSummary = buildPromptSummary({ name, age, age_months, gender, appearance, personality_tags: personalityTags, toy })

    const service = createServiceClient()
    const { data: userRow } = await service
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (!userRow) return { error: "User account not found" }

    const { data: inserted, error } = await service.from("kid_profiles").insert({
      account_id: userRow.account_id,
      name,
      age,
      age_months,
      gender,
      appearance,
      personality_tags: personalityTags,
      toy,
      prompt_summary: promptSummary,
    }).select("*").single()

    if (error) return { error: error.message }

    if (inserted) {
      await service
        .from("kid_profiles")
        .update({ illustration_status: "pending" })
        .eq("id", inserted.id)

      ;(async () => {
        const profileId = inserted.id

        // Step 1 — Character illustration
        const referenceUrl = await generateProfileReferenceImage(inserted as KidProfile).catch(() => null)
        if (!referenceUrl) {
          await service.from("kid_profiles").update({ illustration_status: "failed" }).eq("id", profileId)
          return
        }

        const storedCharPath = await copyRemoteImageToStoragePath({
          supabase: service,
          sourceUrl: referenceUrl,
          buildPath: (ext) => buildProfileReferenceImagePath(userRow.account_id, profileId, ext),
        })

        const charUrlForNext = storedCharPath
          ? (await createSignedImageUrlsMap(service, [storedCharPath])).get(storedCharPath) ?? null
          : referenceUrl

        await service
          .from("kid_profiles")
          .update(
            storedCharPath
              ? { character_illustration_path: storedCharPath, character_illustration_url: null }
              : { character_illustration_url: referenceUrl }
          )
          .eq("id", profileId)

        if (!charUrlForNext) {
          await service.from("kid_profiles").update({ illustration_status: "failed" }).eq("id", profileId)
          return
        }

        // Step 2 — Toy illustration (if toy name provided)
        const hasToyName = !!(toy.name && toy.name !== "their favorite toy")
        if (hasToyName) {
          const toyPrompt = buildToyIllustrationPrompt(toy)
          const falResponse = await fetch("https://fal.run/fal-ai/flux/dev", {
            method: "POST",
            headers: {
              Authorization: `Key ${process.env.FAL_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: toyPrompt,
              negative_prompt: NEGATIVE_PROMPT,
              image_size: "square_hd",
              num_inference_steps: 32,
              guidance_scale: 7.0,
              num_images: 1,
            }),
          }).catch(() => null)

          if (!falResponse?.ok) {
            await service.from("kid_profiles").update({ illustration_status: "failed" }).eq("id", profileId)
            return
          }

          const falData = await falResponse.json().catch(() => null) as { images?: { url: string }[] } | null
          const toyImageUrl = falData?.images?.[0]?.url ?? null

          if (!toyImageUrl) {
            await service.from("kid_profiles").update({ illustration_status: "failed" }).eq("id", profileId)
            return
          }

          const ts = Date.now()
          const storedToyPath = await copyRemoteImageToStoragePath({
            supabase: service,
            sourceUrl: toyImageUrl,
            buildPath: (ext) => `accounts/${userRow.account_id}/profiles/${profileId}/toy/${ts}.${ext}`,
            bucket: GENERATED_IMAGES_BUCKET,
          })

          await service
            .from("kid_profiles")
            .update(
              storedToyPath
                ? { toy_reference_image_path: storedToyPath, toy_reference_image_url: null }
                : { toy_reference_image_url: toyImageUrl }
            )
            .eq("id", profileId)
        }

        // Step 3 — Combined reference
        let toyDescription: string | null = null
        if (toy.name && toy.name !== "their favorite toy") {
          toyDescription = toy.name
          const extra: string[] = []
          if (toy.color) extra.push(toy.color)
          if (toy.type) extra.push(toy.type)
          if (extra.length > 0) toyDescription += `, a ${extra.join(" ")}`
          if (toy.description) toyDescription += ` — ${toy.description}`
        }
        await generateAndSaveCombinedReference(profileId, charUrlForNext, toyDescription)
      })().catch(() => null)
    }

    revalidatePath("/profiles")
    revalidatePath("/generate")
    return { profileId: inserted.id }
  } catch (error) {
    logError("createProfile failed", error, { action: "createProfile" })
    throw error
  }
}

export async function updateProfile(profileId: string, prevState: string | null, formData: FormData): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Not authenticated"

    if (!profileId) return "Profile id is required"

    const parsed = parseProfileFormData(formData)
    if (parsed.error) return parsed.error
    const { name, age, age_months, gender, appearance, personalityTags, toy } = parsed

    if (toy.name && toy.name !== "their favorite toy") {
      const genericDesc = await genericizeToyDescription(toy.name, toy.description)
      if (genericDesc) {
        toy.generic_description = genericDesc
      }
    }

    const promptSummary = buildPromptSummary({ name, age, age_months, gender, appearance, personality_tags: personalityTags, toy })

    const service = createServiceClient()
    const { data: userRow } = await service
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (!userRow) return "User account not found"

    const { data: updated, error } = await service
      .from("kid_profiles")
      .update({
        name,
        age,
        age_months,
        gender,
        appearance,
        personality_tags: personalityTags,
        toy,
        prompt_summary: promptSummary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("account_id", userRow.account_id)
      .is("deleted_at", null)
      .select("id, character_illustration_path, character_illustration_url")
      .single()

    if (error) return error.message

    if (updated) {
      const p = updated as { id: string; character_illustration_path?: string | null; character_illustration_url?: string | null }
      const hasCharIllustration = !!(p.character_illustration_path || p.character_illustration_url)

      if (hasCharIllustration) {
        await service.from("kid_profiles").update({ illustration_status: "generating" }).eq("id", profileId)

        ;(async () => {
          const { data: freshRow } = await service
            .from("kid_profiles")
            .select(
              "id, name, age, age_months, gender, appearance, personality_tags, toy, " +
              "character_illustration_path, character_illustration_url, " +
              "toy_reference_image_path, toy_reference_image_url, " +
              "reference_image_path, reference_image_url, combined_reference_path"
            )
            .eq("id", profileId)
            .single()

          if (!freshRow) {
            await service.from("kid_profiles").update({ illustration_status: "complete" }).eq("id", profileId)
            return
          }

          const fresh = freshRow as unknown as KidProfile & {
            character_illustration_path?: string | null
            character_illustration_url?: string | null
          }

          const charPath = fresh.character_illustration_path
          const charUrl = fresh.character_illustration_url
            ?? (charPath ? (await createSignedImageUrlsMap(service, [charPath])).get(charPath) ?? null : null)

          if (!charUrl) {
            await service.from("kid_profiles").update({ illustration_status: "complete" }).eq("id", profileId)
            return
          }

          // Build toy description string from fresh profile toy fields
          const freshToy = fresh.toy as KidToy | null
          let toyDescription: string | null = null
          if (freshToy?.name) {
            toyDescription = freshToy.name
            const extra: string[] = []
            if (freshToy.color) extra.push(freshToy.color)
            if (freshToy.type) extra.push(freshToy.type)
            if (extra.length > 0) toyDescription += `, a ${extra.join(" ")}`
            if (freshToy.description) toyDescription += ` — ${freshToy.description}`
          }

          await generateAndSaveCombinedReference(profileId, charUrl, toyDescription)
        })().catch(() => null)
      }
    }

    revalidatePath("/profiles")
    revalidatePath("/generate")
    return null
  } catch (error) {
    logError("updateProfile failed", error, { action: "updateProfile" })
    throw error
  }
}

export async function deleteProfile(profileId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const service = createServiceClient()
    const { data: userRow } = await service
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (!userRow) return { error: "User not found" }

    const { error } = await service
      .from("kid_profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", profileId)
      .eq("account_id", userRow.account_id)

    if (error) return { error: error.message }

    revalidatePath("/profiles")
    revalidatePath("/generate")
    return {}
  } catch (error) {
    logError("deleteProfile failed", error, { action: "deleteProfile" })
    throw error
  }
}

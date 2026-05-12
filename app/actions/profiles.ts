"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { buildPromptSummary } from "@/lib/ai/prompt-builder"
import { generateProfileReferenceImage } from "@/lib/ai/image"
import type { KidAppearance, KidToy, KidProfile } from "@/types"

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

export async function createProfile(prevState: string | null, formData: FormData): Promise<string | null> {
  return await Sentry.withServerActionInstrumentation(
    "createProfile",
    { headers: await headers() },
    async () => {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return "Not authenticated"

      const parsed = parseProfileFormData(formData)
      if (parsed.error) return parsed.error
      const { name, age, age_months, gender, appearance, personalityTags, toy } = parsed

      const promptSummary = buildPromptSummary({ name, age, age_months, gender, appearance, personality_tags: personalityTags, toy })

      const service = createServiceClient()
      const { data: userRow } = await service
        .from("users")
        .select("account_id")
        .eq("id", user.id)
        .single()

      if (!userRow) return "User account not found"

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

      if (error) return error.message

      if (inserted) {
        const referenceUrl = await generateProfileReferenceImage(inserted as KidProfile).catch(() => null)
        if (referenceUrl) {
          await service.from("kid_profiles").update({ reference_image_url: referenceUrl }).eq("id", inserted.id)
        }
      }

      revalidatePath("/profiles")
      revalidatePath("/generate")
      return null
    }
  )
}

export async function updateProfile(profileId: string, prevState: string | null, formData: FormData): Promise<string | null> {
  return await Sentry.withServerActionInstrumentation(
    "updateProfile",
    { headers: await headers() },
    async () => {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return "Not authenticated"

      const parsed = parseProfileFormData(formData)
      if (parsed.error) return parsed.error
      const { name, age, age_months, gender, appearance, personalityTags, toy } = parsed

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
        .select("*")
        .single()

      if (error) return error.message

      if (updated) {
        const referenceUrl = await generateProfileReferenceImage(updated as KidProfile).catch(() => null)
        if (referenceUrl) {
          await service.from("kid_profiles").update({ reference_image_url: referenceUrl }).eq("id", profileId)
        }
      }

      revalidatePath("/profiles")
      revalidatePath("/generate")
      return null
    }
  )
}

export async function deleteProfile(profileId: string): Promise<{ error?: string }> {
  return await Sentry.withServerActionInstrumentation(
    "deleteProfile",
    { headers: await headers() },
    async () => {
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
    }
  )
}

"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { buildPromptSummary } from "@/lib/ai/prompt-builder"
import type { KidAppearance, KidToy } from "@/types"

export async function createProfile(prevState: string | null, formData: FormData): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return "Not authenticated"

  const name = formData.get("name") as string
  const ageRaw = formData.get("age") as string
  const personalityRaw = formData.get("personality_tags") as string
  const toyName = formData.get("toy_name") as string
  const toyType = formData.get("toy_type") as string

  if (!name?.trim()) return "Name is required"
  const age = parseInt(ageRaw, 10)
  if (isNaN(age) || age < 1 || age > 12) return "Age must be between 1 and 12"

  const appearance: KidAppearance = {
    hair_color: (formData.get("hair_color") as string) || undefined,
    eye_color: (formData.get("eye_color") as string) || undefined,
  }

  const personalityTags = personalityRaw
    ? personalityRaw.split(",").map(t => t.trim()).filter(Boolean)
    : []

  const toy: KidToy = {
    name: toyName?.trim() || "their favorite toy",
    type: toyType?.trim() || undefined,
  }

  const promptSummary = buildPromptSummary({ name: name.trim(), age, appearance, personality_tags: personalityTags, toy })

  const service = createServiceClient()
  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  if (!userRow) return "User account not found"

  const { error } = await service.from("kid_profiles").insert({
    account_id: userRow.account_id,
    name: name.trim(),
    age,
    appearance,
    personality_tags: personalityTags,
    toy,
    prompt_summary: promptSummary,
  })

  if (error) return error.message

  revalidatePath("/profiles")
  revalidatePath("/generate")
  return null
}

export async function deleteProfile(profileId: string): Promise<{ error?: string }> {
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

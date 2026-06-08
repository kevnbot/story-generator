import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { withRouteLogging } from "@/lib/api/with-logging"
import { logError } from "@/lib/logger"
import { generateProfileReferenceImage, generateAndSaveCombinedReference } from "@/lib/ai/image"
import { NEGATIVE_PROMPT } from "@/lib/ai/image-providers/fal"
import { buildToyIllustrationPrompt } from "@/lib/ai/prompt-builder"
import { copyRemoteImageToStoragePath, createSignedImageUrlsMap, GENERATED_IMAGES_BUCKET } from "@/lib/storage/images"
import type { KidProfile } from "@/types"

type ExtProfile = KidProfile & {
  character_illustration_path?: string | null
  character_illustration_url?: string | null
  toy_reference_image_path?: string | null
  toy_reference_image_url?: string | null
  illustration_status?: string | null
}

// Unsaved form field values sent from the client so the prompt reflects
// what the user currently sees rather than the last-saved database state.
interface CurrentFields {
  name?: string
  gender?: string
  appearance?: { eye_color?: string; skin_tone?: string; hair?: string }
  personality_tags?: string[]
  toy?: { name?: string; description?: string }
}

async function falPost(model: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function extractFalUrl(data: Record<string, unknown>): string | null {
  return (data as { images?: { url: string }[] }).images?.[0]?.url ?? null
}

export const POST = withRouteLogging("profiles/regenerate-reference", async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { profileId, step, currentFields } = (body ?? {}) as {
    profileId?: string
    step?: string
    currentFields?: CurrentFields
  }

  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 })
  if (step !== "character" && step !== "toy") {
    return NextResponse.json({ error: "step must be character or toy" }, { status: 400 })
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()
  if (!userRow) return NextResponse.json({ error: "Account not found" }, { status: 404 })
  const accountId = userRow.account_id as string

  const { data: account } = await supabase
    .from("accounts")
    .select("id, credit_balance")
    .eq("id", accountId)
    .single()
  if (!account || (account as { credit_balance: number }).credit_balance < 1) {
    return NextResponse.json({ error: "Not enough wishes" }, { status: 402 })
  }
  const creditBalance = (account as { credit_balance: number }).credit_balance

  const { data: profileRow } = await supabase
    .from("kid_profiles")
    .select(
      "id, account_id, name, age, age_months, gender, appearance, personality_tags, toy, " +
      "reference_image_path, reference_image_url, prompt_summary, " +
      "character_illustration_path, character_illustration_url, " +
      "toy_reference_image_path, toy_reference_image_url, " +
      "combined_reference_path, combined_reference_url, illustration_status, " +
      "deleted_at, created_at, updated_at"
    )
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()
  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const profile = profileRow as unknown as ExtProfile

  // Merge unsaved form field values over the database profile so the prompt
  // reflects what the user currently sees, not just what's been saved.
  const effectiveProfile: ExtProfile = currentFields
    ? {
        ...profile,
        name: currentFields.name ?? profile.name,
        gender: currentFields.gender ?? profile.gender,
        appearance: {
          ...profile.appearance,
          eye_color: currentFields.appearance?.eye_color ?? profile.appearance?.eye_color,
          skin_tone: currentFields.appearance?.skin_tone ?? profile.appearance?.skin_tone,
          hair: currentFields.appearance?.hair ?? profile.appearance?.hair,
        },
        personality_tags: currentFields.personality_tags ?? profile.personality_tags,
        toy: {
          ...profile.toy,
          name: currentFields.toy?.name ?? profile.toy?.name ?? "",
          description: currentFields.toy?.description ?? profile.toy?.description,
        },
      }
    : profile

  if (step === "toy" && !effectiveProfile.toy?.name) {
    return NextResponse.json({ error: "Profile has no toy name" }, { status: 400 })
  }

  // Generate image
  let imageUrl: string | null = null
  let imageError: string | null = null

  if (step === "character") {
    imageUrl = await generateProfileReferenceImage(effectiveProfile).catch((e: unknown) => {
      imageError = (e instanceof Error ? e.message : null) ?? "Generation failed"
      return null
    })
    if (!imageUrl && !imageError) imageError = "Generation failed or FAL_KEY not configured"
  } else {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 })
    }
    const toyPrompt = buildToyIllustrationPrompt(effectiveProfile)
    const res = await falPost("fal-ai/flux/dev", {
      prompt: toyPrompt,
      negative_prompt: NEGATIVE_PROMPT,
      image_size: "square_hd",
      num_inference_steps: 32,
      guidance_scale: 7.0,
      num_images: 1,
    }).catch((e: unknown) => {
      imageError = (e instanceof Error ? e.message : null) ?? "Request failed"
      return null
    })
    if (res) {
      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`)
        imageError = errText.slice(0, 500)
      } else {
        const data = await res.json() as Record<string, unknown>
        imageUrl = extractFalUrl(data)
        if (!imageUrl) imageError = "No image URL in response"
      }
    }
  }

  if (!imageUrl) {
    return NextResponse.json({ error: imageError ?? "Generation failed" }, { status: 500 })
  }

  const service = createServiceClient()

  // Save image to storage before deducting credit
  const ts = Date.now()
  const path = await copyRemoteImageToStoragePath({
    supabase: service,
    sourceUrl: imageUrl,
    buildPath: (ext) => `accounts/${accountId}/profiles/${profileId}/${step}/${ts}.${ext}`,
    bucket: GENERATED_IMAGES_BUCKET,
  })

  if (!path) {
    return NextResponse.json({ error: "Failed to save image to storage" }, { status: 500 })
  }

  // Deduct credit after successful save
  const { error: creditError } = await service
    .from("accounts")
    .update({ credit_balance: creditBalance - 1 })
    .eq("id", accountId)

  if (creditError) {
    logError("profile regen: credit deduction failed", creditError, {
      area: "profile_regen_credit_deduct",
      profile_id: profileId,
    })
    return NextResponse.json({ error: "Failed to deduct credit" }, { status: 500 })
  }

  try {
    await service.from("credit_transactions").insert({
      account_id: accountId,
      user_id: user.id,
      amount: -1,
      type: "spend",
      description: "Reference image regeneration",
      reference_type: "profile_regeneration",
      reference_id: profileId,
    })

    // Snapshot records what was actually used to generate this image
    const profileSnapshot = {
      name: effectiveProfile.name,
      gender: effectiveProfile.gender,
      age: effectiveProfile.age,
      age_months: effectiveProfile.age_months,
      appearance: effectiveProfile.appearance,
      personality_tags: effectiveProfile.personality_tags,
      toy: effectiveProfile.toy,
    }

    const isChar = step === "character"
    const currentPath = isChar ? profile.character_illustration_path : profile.toy_reference_image_path
    const currentUrl = isChar ? profile.character_illustration_url : profile.toy_reference_image_url

    // Sign current path to get an archivable URL
    let archiveUrl = currentUrl ?? null
    if (!archiveUrl && currentPath) {
      const signedMap = await createSignedImageUrlsMap(service, [currentPath])
      archiveUrl = signedMap.get(currentPath) ?? null
    }

    if (archiveUrl) {
      await service.from("profile_reference_image_history").insert({
        profile_id: profileId,
        account_id: accountId,
        image_type: step,
        image_path: currentPath ?? null,
        image_url: archiveUrl,
        profile_snapshot: profileSnapshot,
        is_active: false,
      })
    }

    // Clear active flag on all existing history rows for this type
    await service
      .from("profile_reference_image_history")
      .update({ is_active: false })
      .eq("profile_id", profileId)
      .eq("image_type", step)

    const profileUpdates = isChar
      ? { character_illustration_path: path, character_illustration_url: null, illustration_status: "complete" }
      : { toy_reference_image_path: path, toy_reference_image_url: null, illustration_status: "complete" }

    await service
      .from("kid_profiles")
      .update(profileUpdates)
      .eq("id", profileId)

    const signedForHistory = await createSignedImageUrlsMap(service, [path])
    const historyUrl = signedForHistory.get(path) ?? imageUrl

    await service.from("profile_reference_image_history").insert({
      profile_id: profileId,
      account_id: accountId,
      image_type: step,
      image_path: path,
      image_url: historyUrl,
      profile_snapshot: profileSnapshot,
      is_active: true,
    })

    // Fire-and-forget combined generation if profile now has both character and toy
    const charPath = isChar ? path : profile.character_illustration_path
    const hasToyName = !!effectiveProfile.toy?.name
    if (charPath && hasToyName) {
      ;(async () => {
        const signedMap = await createSignedImageUrlsMap(service, [charPath])
        const charUrl = signedMap.get(charPath) ?? null
        if (!charUrl) return

        const toyData = effectiveProfile.toy
        let toyDescription: string | null = null
        if (toyData?.name) {
          toyDescription = toyData.name
          const extra: string[] = []
          if (toyData.color) extra.push(toyData.color)
          if (toyData.type) extra.push(toyData.type)
          if (extra.length > 0) toyDescription += `, a ${extra.join(" ")}`
          if (toyData.description) toyDescription += ` — ${toyData.description}`
        }

        await generateAndSaveCombinedReference(profileId, charUrl, toyDescription)
      })().catch(() => null)
    }

    return NextResponse.json({ url: imageUrl, path })
  } catch (e) {
    logError("profile regen: post-deduct failed", e, {
      area: "profile_regen_post_deduct",
      profile_id: profileId,
    })
    // Refund credit
    await service
      .from("accounts")
      .update({ credit_balance: creditBalance })
      .eq("id", accountId)
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 })
  }
})

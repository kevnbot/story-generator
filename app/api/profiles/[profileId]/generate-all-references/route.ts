import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { buildToyIllustrationPrompt } from "@/lib/ai/prompt-builder"
import { generateProfileReferenceImage, generateAndSaveCombinedReference } from "@/lib/ai/image"
import { buildProfileReferenceImagePath, copyRemoteImageToStoragePath, createSignedImageUrlsMap, GENERATED_IMAGES_BUCKET } from "@/lib/storage/images"
import { logError } from "@/lib/logger"
import type { KidProfile, KidToy } from "@/types"

async function failWithError(
  service: ReturnType<typeof createServiceClient>,
  profileId: string,
  message: string
) {
  try {
    await service
      .from("kid_profiles")
      .update({ illustration_status: "failed", illustration_error: message.slice(0, 500) })
      .eq("id", profileId)
  } catch {}
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()
  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { data: profileRow } = await service
    .from("kid_profiles")
    .select("*")
    .eq("id", profileId)
    .eq("account_id", userRow.account_id)
    .is("deleted_at", null)
    .single()
  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const profile = profileRow as KidProfile

  try {
    // Step 1 — Character illustration
    await service.from("kid_profiles").update({ illustration_status: "generating" }).eq("id", profileId)

    let referenceUrl: string | null = null
    let charError: string | null = null
    try {
      referenceUrl = await generateProfileReferenceImage(profile)
    } catch (e) {
      charError = e instanceof Error ? e.message : "Character generation failed"
    }

    if (!referenceUrl) {
      await failWithError(service, profileId, charError ?? "Character generation returned no URL")
      return NextResponse.json({ error: charError }, { status: 500 })
    }

    const storedCharPath = await copyRemoteImageToStoragePath({
      supabase: service,
      sourceUrl: referenceUrl,
      buildPath: (ext) => buildProfileReferenceImagePath(userRow.account_id, profileId, ext),
    })

    await service
      .from("kid_profiles")
      .update(
        storedCharPath
          ? { character_illustration_path: storedCharPath, character_illustration_url: null }
          : { character_illustration_url: referenceUrl }
      )
      .eq("id", profileId)

    const charUrlForNext = storedCharPath
      ? (await createSignedImageUrlsMap(service, [storedCharPath])).get(storedCharPath) ?? null
      : referenceUrl

    if (!charUrlForNext) {
      await failWithError(service, profileId, "Could not resolve character URL")
      return NextResponse.json({ error: "Could not resolve character URL" }, { status: 500 })
    }

    // Step 2 — Toy illustration (non-fatal)
    const toy = profile.toy as KidToy | null
    const hasToyName = !!(toy?.name && toy.name !== "their favorite toy")

    if (hasToyName && toy) {
      try {
        const toyPrompt = buildToyIllustrationPrompt(toy)
        const falResponse = await fetch("https://fal.run/fal-ai/flux/dev", {
          method: "POST",
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: toyPrompt,
            image_size: "square_hd",
            num_inference_steps: 32,
            guidance_scale: 7.0,
            num_images: 1,
          }),
        })

        if (!falResponse.ok) {
          const body = await falResponse.text().catch(() => `HTTP ${falResponse.status}`)
          throw new Error(`fal error ${falResponse.status}: ${body.slice(0, 300)}`)
        }

        const falData = await falResponse.json() as { images?: { url: string }[] }
        const toyImageUrl = falData?.images?.[0]?.url ?? null

        if (toyImageUrl) {
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
      } catch (e) {
        // Toy failure is non-fatal — log it but continue to combined
        logError("toy illustration failed", e, { profile_id: profileId })
      }
    }

    // Step 3 — Combined reference
    let toyDescription: string | null = null
    if (toy?.name && toy.name !== "their favorite toy") {
      toyDescription = toy.name
      const extra: string[] = []
      if (toy.color) extra.push(toy.color)
      if (toy.type) extra.push(toy.type)
      if (extra.length > 0) toyDescription += `, a ${extra.join(" ")}`
      if (toy.description) toyDescription += ` — ${toy.description}`
    }

    try {
      await generateAndSaveCombinedReference(profileId, charUrlForNext, toyDescription)
      // generateAndSaveCombinedReference sets illustration_status = "complete"
    } catch (e) {
      await failWithError(service, profileId, e instanceof Error ? e.message : "Combined reference failed")
      return NextResponse.json({ error: "Combined reference failed" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    logError("generate-all-references failed", e, { profile_id: profileId })
    await failWithError(service, profileId, e instanceof Error ? e.message : "Pipeline failed")
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 })
  }
}

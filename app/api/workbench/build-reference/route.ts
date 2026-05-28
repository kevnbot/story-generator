import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { createSignedImageUrlsMap } from "@/lib/storage/images"
import { NEGATIVE_PROMPT } from "@/lib/ai/image-providers/fal"
import { applyArtStyleToReference } from "@/lib/ai/image"

async function falRun(model: string, body: Record<string, unknown>): Promise<Response> {
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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const profileIds = body?.profileIds as string[] | undefined
  const artStyleId = body?.artStyleId as string | undefined

  if (!profileIds?.length) return NextResponse.json({ error: "profileIds required" }, { status: 400 })

  const service = createServiceClient()

  const [profilesResult, artStyleResult] = await Promise.all([
    service
      .from("kid_profiles")
      .select("id, name, age, age_months, gender, appearance, personality_tags, toy, reference_image_path, reference_image_url, combined_reference_path, character_illustration_path, illustration_status")
      .in("id", profileIds)
      .is("deleted_at", null),
    artStyleId
      ? service
          .from("art_styles")
          .select("id, name, prompt_prefix")
          .eq("id", artStyleId)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const profiles = profilesResult.data ?? []
  if (!profiles.length) return NextResponse.json({ error: "Profiles not found" }, { status: 404 })

  const artStyle = artStyleResult.data as { id: string; name: string; prompt_prefix: string } | null

  // Resolve signed URLs for all storage paths
  const allPaths = profiles.flatMap(p => [
    p.combined_reference_path,
    p.character_illustration_path,
    p.reference_image_path,
  ]).filter((path): path is string => Boolean(path))

  const signedUrlsMap = await createSignedImageUrlsMap(service, allPaths)

  // Build profileRefs using best available URL per profile
  type ProfileRef = { profileId: string; name: string; url: string | null; storageField: string }
  const profileRefs: ProfileRef[] = profiles.map(p => {
    if (p.combined_reference_path) {
      return { profileId: p.id, name: p.name, url: signedUrlsMap.get(p.combined_reference_path) ?? null, storageField: "combined_reference_path" }
    }
    if (p.character_illustration_path) {
      return { profileId: p.id, name: p.name, url: signedUrlsMap.get(p.character_illustration_path) ?? null, storageField: "character_illustration_path" }
    }
    if (p.reference_image_path) {
      return { profileId: p.id, name: p.name, url: signedUrlsMap.get(p.reference_image_path) ?? (p.reference_image_url as string | null) ?? null, storageField: "reference_image_path" }
    }
    if (p.reference_image_url) {
      return { profileId: p.id, name: p.name, url: p.reference_image_url as string, storageField: "reference_image_url" }
    }
    return { profileId: p.id, name: p.name, url: null, storageField: "none" }
  })

  const profilesWithRef = profileRefs.filter(r => r.url !== null)

  type CompositingStep = {
    addedProfileName: string
    prompt: string
    model: string
    resultUrl: string
    durationMs: number
    success: boolean
    error: string | null
  }
  const compositingSteps: CompositingStep[] = []

  let baseReferenceUrl: string | null = profilesWithRef[0]?.url ?? null

  if (profilesWithRef.length > 1) {
    let currentImageUrl = profilesWithRef[0].url!

    for (let i = 1; i < profilesWithRef.length; i++) {
      const ref = profilesWithRef[i]
      const profile = profiles.find(p => p.id === ref.profileId)!
      const app = profile.appearance as { skin_tone?: string; hair?: string; hair_color?: string; eye_color?: string } | null

      const humanGender = profile.gender === "girl" ? "human girl"
        : profile.gender === "boy" ? "human boy"
        : "human child"

      const appearanceParts: string[] = []
      if (app?.skin_tone) appearanceParts.push(`${app.skin_tone} skin`)
      if (app?.hair) appearanceParts.push(`${app.hair} hair`)
      else if (app?.hair_color) appearanceParts.push(`${app.hair_color} hair`)
      if (app?.eye_color) appearanceParts.push(`${app.eye_color} eyes`)
      const appearanceStr = appearanceParts.length > 0 ? ` with ${appearanceParts.join(", ")}` : ""

      const existingNames = profilesWithRef.slice(0, i).map(r => r.name).join(" and ")
      const model = "fal-ai/flux-pro/kontext"
      const prompt = `Add ${profile.name}, a ${humanGender}${appearanceStr}, standing next to ${existingNames}. ${profile.name} is a human child, not an animal. Keep all existing characters exactly as they appear. Simple white background, children's picture book character reference sheet, all characters fully visible.`

      const stepStart = Date.now()
      try {
        const response = await falRun(model, {
          prompt,
          negative_prompt: NEGATIVE_PROMPT,
          image_url: currentImageUrl,
          image_size: "landscape_4_3",
          num_inference_steps: 28,
          guidance_scale: 7.5,
          num_images: 1,
        })
        const durationMs = Date.now() - stepStart

        if (response.ok) {
          const data = await response.json()
          const url = extractFalUrl(data)
          if (url) {
            currentImageUrl = url
            compositingSteps.push({ addedProfileName: profile.name, prompt, model, resultUrl: url, durationMs, success: true, error: null })
          } else {
            compositingSteps.push({ addedProfileName: profile.name, prompt, model, resultUrl: "", durationMs, success: false, error: "No image URL in response" })
          }
        } else {
          const errorText = await response.text().catch(() => `HTTP ${response.status}`)
          compositingSteps.push({ addedProfileName: profile.name, prompt, model, resultUrl: "", durationMs, success: false, error: errorText.slice(0, 500) })
        }
      } catch (err) {
        const durationMs = Date.now() - stepStart
        compositingSteps.push({ addedProfileName: profile.name, prompt, model, resultUrl: "", durationMs, success: false, error: err instanceof Error ? err.message : "Unknown error" })
      }
    }

    baseReferenceUrl = currentImageUrl
  }

  // Style transfer
  let styleTransfer: {
    inputUrl: string
    artStylePrefix: string
    model: string
    resultUrl: string
    durationMs: number
    success: boolean
  } | null = null
  let styledReferenceUrl: string | null = baseReferenceUrl

  if (baseReferenceUrl && artStyle?.prompt_prefix) {
    const styleDescription = artStyle.prompt_prefix.replace(/[,\s]+$/, "")
    const inputUrl = baseReferenceUrl
    const styleStart = Date.now()
    const resultUrl = await applyArtStyleToReference(baseReferenceUrl, styleDescription)
    const durationMs = Date.now() - styleStart
    styledReferenceUrl = resultUrl
    styleTransfer = {
      inputUrl,
      artStylePrefix: styleDescription,
      model: "fal-ai/flux-pro/kontext",
      resultUrl,
      durationMs,
      success: resultUrl !== inputUrl,
    }
  }

  return NextResponse.json({
    profileRefs,
    compositingSteps,
    baseReferenceUrl,
    styleTransfer,
    styledReferenceUrl,
  })
}

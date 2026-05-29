import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { generateProfileReferenceImage } from "@/lib/ai/image"
import { NEGATIVE_PROMPT } from "@/lib/ai/image-providers/fal"
import type { KidProfile } from "@/types"

type StepType = "character" | "toy" | "combined"

type ExtProfile = KidProfile & {
  character_illustration_url?: string | null
  toy_reference_image_path?: string | null
  toy_reference_image_url?: string | null
}

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
  const { step, profileId, characterUrl, toyUrl } = (body ?? {}) as {
    step?: StepType
    profileId?: string
    characterUrl?: string
    toyUrl?: string
  }

  if (!step || !["character", "toy", "combined"].includes(step)) {
    return NextResponse.json({ error: "step must be character, toy, or combined" }, { status: 400 })
  }
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 })

  const service = createServiceClient()

  const { data: profileRow } = await service
    .from("kid_profiles")
    .select("*")
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()

  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const profile = profileRow as ExtProfile

  const startMs = Date.now()

  if (step === "character") {
    const url = await generateProfileReferenceImage(profile)
    const durationMs = Date.now() - startMs
    return NextResponse.json({
      url,
      prompt: null,
      model: "fal-ai/flux/dev",
      durationMs,
      attempts: 1,
      error: url ? null : "Generation failed or FAL_KEY not configured",
    })
  }

  if (step === "toy") {
    const toy = profile.toy
    if (!toy?.name) {
      return NextResponse.json({ error: "Profile has no toy name" }, { status: 400 })
    }

    const humanPronoun = profile.gender === "girl" ? "her" : profile.gender === "boy" ? "his" : "their"
    let toyDesc = toy.name
    if (toy.description) toyDesc += `, ${toy.description}`
    else if (toy.type) toyDesc += ` (a ${toy.type})`

    const toyPrompt = `${profile.name}'s favorite toy: ${toyDesc}. An isolated stuffed plushie toy on a plain white background. The toy is a separate object, not a character. Children's picture book illustration style, simple, clean, detailed, ${humanPronoun} beloved companion toy.`

    const model = "fal-ai/flux/dev"
    const response = await falRun(model, {
      prompt: toyPrompt,
      negative_prompt: NEGATIVE_PROMPT,
      image_size: "square_hd",
      num_inference_steps: 32,
      guidance_scale: 7.0,
      num_images: 1,
    })
    const durationMs = Date.now() - startMs

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`)
      return NextResponse.json({
        url: null,
        prompt: toyPrompt,
        model,
        durationMs,
        attempts: 1,
        error: errorText.slice(0, 500),
      })
    }

    const data = await response.json()
    const url = extractFalUrl(data)
    return NextResponse.json({
      url,
      prompt: toyPrompt,
      model,
      durationMs,
      attempts: 1,
      error: url ? null : "No image URL in response",
    })
  }

  // step === "combined"
  const charUrl = characterUrl ?? profile.character_illustration_url ?? profile.reference_image_url
  const toyUrlResolved = toyUrl ?? profile.toy_reference_image_url

  if (!charUrl) {
    return NextResponse.json({ error: "Character illustration required — generate one in Step R1 first" }, { status: 400 })
  }

  const toy = profile.toy
  const toyName = toy?.name ?? "toy"
  const toyDescription = toy?.description ?? ""
  const toyClause = toyDescription ? `${toyName} (${toyDescription})` : toyName

  const toyRefUrl = toyUrlResolved ?? null

  const model = "fal-ai/flux-pro/kontext"

  const combinedPrompt = toyRefUrl
    ? `Add ${profile.name}'s toy to their hands: ${toyClause}. The toy is a stuffed plushie held in their hands, not part of their body. Keep ${profile.name} exactly as they appear. Simple white background.`
    : `Show ${profile.name} holding their favorite toy ${toyClause}. The toy is a separate stuffed plushie in their hands, not part of ${profile.name}'s body. Keep ${profile.name} exactly as they appear. Simple white background, children's picture book character reference sheet.`

  const response = await falRun(model, {
    prompt: combinedPrompt,
    negative_prompt: NEGATIVE_PROMPT,
    image_url: charUrl,
    image_size: "portrait_4_3",
    num_inference_steps: 28,
    guidance_scale: 7.5,
    num_images: 1,
  })
  const durationMs = Date.now() - startMs

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    return NextResponse.json({
      url: null,
      prompt: combinedPrompt,
      model,
      durationMs,
      attempts: 1,
      error: errorText.slice(0, 500),
    })
  }

  const data = await response.json()
  const url = extractFalUrl(data)
  return NextResponse.json({
    url,
    prompt: combinedPrompt,
    model,
    durationMs,
    attempts: 1,
    error: url ? null : "No image URL in response",
  })
}

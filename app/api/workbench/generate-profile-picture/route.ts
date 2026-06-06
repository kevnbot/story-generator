import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { buildProfilePicturePrompt } from "@/lib/ai/prompt-builder"

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

function extractUrl(data: Record<string, unknown>): string | null {
  return (data as { images?: { url: string }[] }).images?.[0]?.url ?? null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const { profileId, characterIllustrationUrl } = (body ?? {}) as {
    profileId?: string
    characterIllustrationUrl?: string
  }

  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 })
  if (!characterIllustrationUrl) return NextResponse.json({ error: "characterIllustrationUrl required" }, { status: 400 })

  const service = createServiceClient()

  const { data: profileRow } = await service
    .from("kid_profiles")
    .select("id, name, age, age_months, gender, toy")
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()

  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const row = profileRow as {
    id: string
    name: string
    age: number
    age_months: number | null
    gender?: string | null
    toy?: { name?: string; description?: string } | null
  }

  const toyRaw = row.toy
  const toyArg = toyRaw?.name ? { name: toyRaw.name, description: toyRaw.description ?? null } : null
  const prompt = buildProfilePicturePrompt(
    {
      name: row.name,
      age: row.age,
      age_months: row.age_months ?? 0,
      gender: row.gender ?? undefined,
    },
    toyArg
  )

  const startMs = Date.now()
  const model = "fal-ai/flux-pro/kontext"
  const response = await falPost(model, {
    prompt,
    image_url: characterIllustrationUrl,
    image_size: "portrait_4_3",
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: "jpeg",
    safety_tolerance: "2",
    enhance_prompt: false,
  })

  const durationMs = Date.now() - startMs

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    return NextResponse.json({
      url: null,
      prompt,
      model,
      durationMs,
      error: errorText.slice(0, 500),
    })
  }

  const data = await response.json()
  const url = extractUrl(data)
  return NextResponse.json({
    url,
    prompt,
    model,
    durationMs,
    error: url ? null : "No image URL in response",
  })
}

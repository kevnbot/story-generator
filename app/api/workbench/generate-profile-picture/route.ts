import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { buildProfilePicturePrompt } from "@/lib/ai/prompt-builder"
import { generateAndSaveCombinedReference } from "@/lib/ai/image"
import { createSignedImageUrl } from "@/lib/storage/images"

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
    toy?: { name?: string; type?: string; color?: string; description?: string } | null
  }

  const toyRaw = row.toy

  // Build toy description string
  let toyDescription: string | null = null
  if (toyRaw?.name) {
    toyDescription = toyRaw.name
    const extra: string[] = []
    if (toyRaw.color) extra.push(toyRaw.color)
    if (toyRaw.type) extra.push(toyRaw.type)
    if (extra.length > 0) toyDescription += `, a ${extra.join(" ")}`
    if (toyRaw.description) toyDescription += ` — ${toyRaw.description}`
  }

  // Build the prompt to include in the response (same logic used inside generateAndSaveCombinedReference)
  const toyArg = toyDescription ? { name: toyDescription } : null
  const prompt = buildProfilePicturePrompt(
    { name: row.name, age: row.age, age_months: row.age_months ?? 0, gender: row.gender ?? undefined },
    toyArg
  )

  const model = "fal-ai/flux-pro/kontext"
  const startMs = Date.now()
  const storagePath = await generateAndSaveCombinedReference(profileId, characterIllustrationUrl, toyDescription)
  const durationMs = Date.now() - startMs

  if (!storagePath) {
    return NextResponse.json({ url: null, prompt, model, durationMs, error: "Generation or save failed" })
  }

  const url = await createSignedImageUrl(service, storagePath)
  return NextResponse.json({ url, prompt, model, durationMs, error: url ? null : "Failed to sign URL" })
}

import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { createSignedImageUrlsMap } from "@/lib/storage/images"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const profileId = body?.profileId as string | undefined

  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 })

  const service = createServiceClient()

  const { data: profileRow } = await service
    .from("kid_profiles")
    .select(
      "id, name, age, age_months, gender, appearance, personality_tags, toy, " +
      "reference_image_path, reference_image_url, " +
      "character_illustration_path, character_illustration_url, " +
      "toy_reference_image_path, toy_reference_image_url, " +
      "combined_reference_path, combined_reference_url, illustration_status"
    )
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()

  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const p = profileRow as Record<string, unknown>

  const paths = [
    p.reference_image_path,
    p.character_illustration_path,
    p.toy_reference_image_path,
    p.combined_reference_path,
  ].filter((v): v is string => typeof v === "string" && v.length > 0)

  const signedUrlsMap = await createSignedImageUrlsMap(service, paths)

  function resolve(path: string | unknown, fallback: string | unknown): string | null {
    if (typeof path === "string" && path) return signedUrlsMap.get(path) ?? (typeof fallback === "string" ? fallback : null)
    return typeof fallback === "string" ? fallback : null
  }

  return NextResponse.json({
    ...p,
    reference_image_url: resolve(p.reference_image_path, p.reference_image_url),
    character_illustration_url: resolve(p.character_illustration_path, p.character_illustration_url),
    toy_reference_image_url: resolve(p.toy_reference_image_path, p.toy_reference_image_url),
    combined_reference_url: resolve(p.combined_reference_path, p.combined_reference_url),
  })
}

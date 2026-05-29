import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { copyRemoteImageToStoragePath, GENERATED_IMAGES_BUCKET } from "@/lib/storage/images"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const profileId = body?.profileId as string | undefined
  const characterUrl = body?.characterUrl as string | undefined
  const toyUrl = body?.toyUrl as string | undefined
  const combinedUrl = body?.combinedUrl as string | undefined

  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 })

  const service = createServiceClient()

  const { data: profileRow } = await service
    .from("kid_profiles")
    .select("id, account_id")
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()

  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const accountId = profileRow.account_id as string
  const updated: string[] = []
  const updates: Record<string, string | null> = {}
  const ts = Date.now()

  if (characterUrl) {
    const path = await copyRemoteImageToStoragePath({
      supabase: service,
      sourceUrl: characterUrl,
      buildPath: (ext) => `accounts/${accountId}/profiles/${profileId}/character/${ts}.${ext}`,
      bucket: GENERATED_IMAGES_BUCKET,
    })
    if (path) {
      updates.character_illustration_path = path
      updated.push("character_illustration_path")
    }
  }

  if (toyUrl) {
    const path = await copyRemoteImageToStoragePath({
      supabase: service,
      sourceUrl: toyUrl,
      buildPath: (ext) => `accounts/${accountId}/profiles/${profileId}/toy/${ts}.${ext}`,
      bucket: GENERATED_IMAGES_BUCKET,
    })
    if (path) {
      updates.toy_reference_image_path = path
      updated.push("toy_reference_image_path")
    }
  }

  if (combinedUrl) {
    const path = await copyRemoteImageToStoragePath({
      supabase: service,
      sourceUrl: combinedUrl,
      buildPath: (ext) => `accounts/${accountId}/profiles/${profileId}/combined/${ts}.${ext}`,
      bucket: GENERATED_IMAGES_BUCKET,
    })
    if (path) {
      updates.combined_reference_path = path
      updated.push("combined_reference_path")
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.illustration_status = combinedUrl ? "complete" : "generating"
    await service
      .from("kid_profiles")
      .update(updates)
      .eq("id", profileId)
  }

  return NextResponse.json({ updated })
}

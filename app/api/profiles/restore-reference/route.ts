import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { copyRemoteImageToStoragePath, GENERATED_IMAGES_BUCKET } from "@/lib/storage/images"
import type { ProfileReferenceImageHistory } from "@/types"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { profileId, historyId } = (body ?? {}) as { profileId?: string; historyId?: string }

  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 })
  if (!historyId) return NextResponse.json({ error: "historyId required" }, { status: 400 })

  const { data: userRow } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()
  if (!userRow) return NextResponse.json({ error: "Account not found" }, { status: 404 })
  const accountId = userRow.account_id as string

  const service = createServiceClient()

  const { data: historyRow } = await service
    .from("profile_reference_image_history")
    .select("id, profile_id, account_id, image_type, image_url, image_path, profile_snapshot, activation_count")
    .eq("id", historyId)
    .single()

  if (!historyRow) return NextResponse.json({ error: "History entry not found" }, { status: 404 })

  const row = historyRow as unknown as ProfileReferenceImageHistory & { image_url: string }

  if (row.account_id !== accountId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const isChar = row.image_type === "character"
  const ts = Date.now()

  const path = await copyRemoteImageToStoragePath({
    supabase: service,
    sourceUrl: row.image_url,
    buildPath: (ext) => `accounts/${accountId}/profiles/${profileId}/${isChar ? "character" : "toy"}/${ts}.${ext}`,
    bucket: GENERATED_IMAGES_BUCKET,
  })

  if (!path) {
    return NextResponse.json({ error: "Failed to copy image to storage" }, { status: 500 })
  }

  // Deactivate all history rows for this profile + type
  await service
    .from("profile_reference_image_history")
    .update({ is_active: false })
    .eq("profile_id", profileId)
    .eq("image_type", row.image_type)

  // Activate the selected history row
  await service
    .from("profile_reference_image_history")
    .update({
      is_active: true,
      activation_count: (row.activation_count ?? 0) + 1,
      last_activated_at: new Date().toISOString(),
    })
    .eq("id", historyId)

  // Update kid_profiles with the restored path
  const profileUpdates = isChar
    ? { character_illustration_path: path, character_illustration_url: null, illustration_status: "generating" }
    : { toy_reference_image_path: path, toy_reference_image_url: null, illustration_status: "generating" }

  await service
    .from("kid_profiles")
    .update(profileUpdates)
    .eq("id", profileId)

  return NextResponse.json({
    path,
    profileSnapshot: row.profile_snapshot ?? null,
  })
}

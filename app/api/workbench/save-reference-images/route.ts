import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { copyRemoteImageToStoragePath, createSignedImageUrlsMap, GENERATED_IMAGES_BUCKET } from "@/lib/storage/images"

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
    .select(
      "id, account_id, " +
      "character_illustration_path, character_illustration_url, reference_image_url, " +
      "toy_reference_image_path, toy_reference_image_url, " +
      "combined_reference_path, combined_reference_url"
    )
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()

  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const row = profileRow as unknown as {
    id: string
    account_id: string
    character_illustration_path: string | null
    character_illustration_url: string | null
    reference_image_url: string | null
    toy_reference_image_path: string | null
    toy_reference_image_url: string | null
    combined_reference_path: string | null
    combined_reference_url: string | null
  }

  const accountId = row.account_id

  // Resolve signed URLs for paths whose URL column is null, so history captures a usable URL
  const pathsNeedingSigning = [
    characterUrl && !row.character_illustration_url ? row.character_illustration_path : null,
    toyUrl && !row.toy_reference_image_url ? row.toy_reference_image_path : null,
    combinedUrl && !row.combined_reference_url ? row.combined_reference_path : null,
  ].filter((p): p is string => typeof p === "string" && p.length > 0)

  const signedUrlsMap = pathsNeedingSigning.length > 0
    ? await createSignedImageUrlsMap(service, pathsNeedingSigning)
    : new Map<string, string>()

  function resolveCurrentUrl(path: string | null, storedUrl: string | null, fallback?: string | null): string | null {
    if (storedUrl) return storedUrl
    if (path) return signedUrlsMap.get(path) ?? null
    return fallback ?? null
  }

  // Archive current URLs before overwriting
  type HistoryInsert = { profile_id: string; account_id: string; image_type: string; image_path: string | null; image_url: string }
  const historyInserts: HistoryInsert[] = []

  if (characterUrl) {
    const currentUrl = resolveCurrentUrl(row.character_illustration_path, row.character_illustration_url, row.reference_image_url)
    if (currentUrl) {
      historyInserts.push({ profile_id: profileId, account_id: accountId, image_type: "character", image_path: row.character_illustration_path ?? null, image_url: currentUrl })
    }
  }
  if (toyUrl) {
    const currentUrl = resolveCurrentUrl(row.toy_reference_image_path, row.toy_reference_image_url)
    if (currentUrl) {
      historyInserts.push({ profile_id: profileId, account_id: accountId, image_type: "toy", image_path: row.toy_reference_image_path ?? null, image_url: currentUrl })
    }
  }
  if (combinedUrl) {
    const currentUrl = resolveCurrentUrl(row.combined_reference_path, row.combined_reference_url)
    if (currentUrl) {
      historyInserts.push({ profile_id: profileId, account_id: accountId, image_type: "combined", image_path: row.combined_reference_path ?? null, image_url: currentUrl })
    }
  }

  if (historyInserts.length > 0) {
    await service.from("profile_reference_image_history").insert(historyInserts)
  }

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

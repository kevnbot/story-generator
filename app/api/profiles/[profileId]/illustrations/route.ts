import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { withRouteLogging } from "@/lib/api/with-logging"
import { createSignedImageUrlsMap } from "@/lib/storage/images"
import type { ProfileReferenceImageHistory } from "@/types"

type HistoryRow = Pick<ProfileReferenceImageHistory,
  "id" | "image_type" | "image_url" | "created_at" |
  "profile_snapshot" | "is_active" | "activation_count" | "last_activated_at"
>

export const GET = withRouteLogging("profiles/[profileId]/illustrations", async (
  _request: NextRequest,
  context: { params: Promise<{ profileId: string }> }
) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { profileId } = await context.params

  const { data: profileRow } = await supabase
    .from("kid_profiles")
    .select(
      "id, name, age, age_months, gender, appearance, personality_tags, toy, " +
      "reference_image_path, reference_image_url, " +
      "character_illustration_path, character_illustration_url, " +
      "toy_reference_image_path, toy_reference_image_url, " +
      "combined_reference_path, combined_reference_url, " +
      "illustration_status, illustration_error"
    )
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()

  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const p = profileRow as unknown as Record<string, unknown> & {
    reference_image_path: string | null
    character_illustration_path: string | null
    toy_reference_image_path: string | null
    combined_reference_path: string | null
    reference_image_url: string | null
    character_illustration_url: string | null
    toy_reference_image_url: string | null
    combined_reference_url: string | null
  }

  const service = createServiceClient()

  const paths = [
    p.reference_image_path,
    p.character_illustration_path,
    p.toy_reference_image_path,
    p.combined_reference_path,
  ].filter((v): v is string => typeof v === "string" && v.length > 0)

  const [signedUrlsMap, charHistoryResult, toyHistoryResult] = await Promise.all([
    paths.length > 0 ? createSignedImageUrlsMap(service, paths) : Promise.resolve(new Map<string, string>()),
    service
      .from("profile_reference_image_history")
      .select("id, image_type, image_url, created_at, profile_snapshot, is_active, activation_count, last_activated_at")
      .eq("profile_id", profileId)
      .eq("image_type", "character")
      .order("created_at", { ascending: false })
      .limit(5),
    service
      .from("profile_reference_image_history")
      .select("id, image_type, image_url, created_at, profile_snapshot, is_active, activation_count, last_activated_at")
      .eq("profile_id", profileId)
      .eq("image_type", "toy")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  function resolve(path: string | null | undefined, fallback: string | null | undefined): string | null {
    if (path) return signedUrlsMap.get(path) ?? fallback ?? null
    return fallback ?? null
  }

  return NextResponse.json({
    ...p,
    reference_image_url: resolve(p.reference_image_path, p.reference_image_url),
    character_illustration_url: resolve(p.character_illustration_path, p.character_illustration_url),
    toy_reference_image_url: resolve(p.toy_reference_image_path, p.toy_reference_image_url),
    combined_reference_url: resolve(p.combined_reference_path, p.combined_reference_url),
    history: {
      character: (charHistoryResult.data ?? []) as HistoryRow[],
      toy: (toyHistoryResult.data ?? []) as HistoryRow[],
    },
  })
})

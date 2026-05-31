import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { createSignedImageUrlsMap } from "@/lib/storage/images"
import { getProfileReferencePaths, resolveProfileReferences } from "@/lib/ai/profile-references"

type WorkbenchReferenceProfile = {
  id: string
  name: string
  reference_image_path: string | null
  reference_image_url: string | null
  combined_reference_path: string | null
  combined_reference_url?: string | null
  character_illustration_path: string | null
  character_illustration_url?: string | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const profileIds = body?.profileIds as string[] | undefined

  if (!profileIds?.length) return NextResponse.json({ error: "profileIds required" }, { status: 400 })

  const service = createServiceClient()

  const { data } = await service
    .from("kid_profiles")
    .select(
      "id, name, reference_image_path, reference_image_url, " +
      "combined_reference_path, combined_reference_url, " +
      "character_illustration_path, character_illustration_url"
    )
    .in("id", profileIds)
    .is("deleted_at", null)

  const rows = ((data ?? []) as unknown) as WorkbenchReferenceProfile[]
  const rowsById = new Map(rows.map((profile) => [profile.id, profile]))
  const profiles = profileIds
    .map((id) => rowsById.get(id))
    .filter((profile): profile is WorkbenchReferenceProfile => Boolean(profile))
  if (!profiles.length) return NextResponse.json({ error: "Profiles not found" }, { status: 404 })

  const signedUrlsMap = await createSignedImageUrlsMap(service, getProfileReferencePaths(profiles))
  const profileRefs = resolveProfileReferences(profiles, signedUrlsMap)
  const missingNames = profileRefs
    .filter((ref) => !ref.url)
    .map((ref) => ref.name)
  if (missingNames.length > 0) {
    return NextResponse.json(
      { error: `Reference images could not be resolved for: ${missingNames.join(", ")}.` },
      { status: 400 }
    )
  }

  const referenceImageRefs = profileRefs.filter((ref) => ref.url)
  const referenceImageUrls = referenceImageRefs.map((ref) => ref.url!)
  const referenceImageLabels = referenceImageRefs.map((ref) => `${ref.name}'s profile reference`)

  return NextResponse.json({
    profileRefs,
    referenceImageUrls,
    referenceImageLabels,
    compositingSteps: [],
    baseReferenceUrl: referenceImageUrls[0] ?? null,
    styleTransfer: null,
    styledReferenceUrl: referenceImageUrls[0] ?? null,
  })
}

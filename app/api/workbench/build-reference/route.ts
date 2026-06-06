import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { createSignedImageUrlsMap } from "@/lib/storage/images"
import { getProfileReferencePaths, resolveProfileReferences } from "@/lib/ai/profile-references"
import { resolveCharacterReferences } from "@/lib/ai/providers/image/fal"
import type { CharacterReference } from "@/lib/ai/providers/image/options"

type WorkbenchReferenceProfile = {
  id: string
  name: string
  reference_image_path: string | null
  reference_image_url: string | null
  combined_reference_path: string | null
  combined_reference_url?: string | null
  character_illustration_path: string | null
  character_illustration_url?: string | null
  toy_reference_image_path: string | null
  toy_reference_image_url?: string | null
  toy?: { name?: string; description?: string } | null
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
      "character_illustration_path, character_illustration_url, " +
      "toy_reference_image_path, toy_reference_image_url, toy"
    )
    .in("id", profileIds)
    .is("deleted_at", null)

  const rows = ((data ?? []) as unknown) as WorkbenchReferenceProfile[]
  const rowsById = new Map(rows.map((profile) => [profile.id, profile]))
  const profiles = profileIds
    .map((id) => rowsById.get(id))
    .filter((profile): profile is WorkbenchReferenceProfile => Boolean(profile))
  if (!profiles.length) return NextResponse.json({ error: "Profiles not found" }, { status: 404 })

  // Collect storage paths for batch signing
  const storagePaths: string[] = [
    ...getProfileReferencePaths(profiles),
    ...profiles.flatMap(p => p.toy_reference_image_path ? [p.toy_reference_image_path] : []),
  ]
  const signedUrlsMap = await createSignedImageUrlsMap(service, storagePaths)

  // profileRefs: keep existing shape for Stage 4a display
  const profileRefs = resolveProfileReferences(profiles, signedUrlsMap)

  const characterReferences: CharacterReference[] = []

  for (const profile of profiles) {
    // Resolve character illustration: character_illustration_path → reference_image_path → skip
    let characterUrl: string | null = null
    if (profile.character_illustration_path) {
      characterUrl = signedUrlsMap.get(profile.character_illustration_path) ?? null
    }
    if (!characterUrl && profile.reference_image_path) {
      characterUrl = signedUrlsMap.get(profile.reference_image_path) ?? null
    }

    if (!characterUrl) {
      Sentry.logger.warn("build-reference: character illustration not found for profile", {
        profile_id: profile.id,
        profile_name: profile.name,
      })
      continue
    }

    characterReferences.push({
      name: profile.name,
      imageUrl: characterUrl,
      role: "profile",
    })

    // Resolve toy illustration: toy_reference_image_path → skip (not fatal)
    const toyName = profile.toy?.name
    if (toyName) {
      let toyUrl: string | null = null
      if (profile.toy_reference_image_path) {
        toyUrl = signedUrlsMap.get(profile.toy_reference_image_path) ?? profile.toy_reference_image_url ?? null
      } else if (profile.toy_reference_image_url) {
        toyUrl = profile.toy_reference_image_url
      }

      if (!toyUrl) {
        Sentry.logger.warn("build-reference: toy illustration not found for profile", {
          profile_id: profile.id,
          profile_name: profile.name,
          toy_name: toyName,
        })
      } else {
        characterReferences.push({
          name: toyName,
          imageUrl: toyUrl,
          role: "toy",
          boundTo: profile.name,
          ...(profile.toy?.description ? { description: profile.toy.description } : {}),
        })
      }
    }
  }

  const { urls: referenceImageUrls, labels: referenceImageLabels } = resolveCharacterReferences(characterReferences)

  return NextResponse.json({
    characterReferences,
    profileRefs,
    referenceImageUrls,
    referenceImageLabels,
    storyCharacterRefs: [] as CharacterReference[],
    compositingSteps: [],
    baseReferenceUrl: referenceImageUrls[0] ?? null,
    styleTransfer: null,
    styledReferenceUrl: referenceImageUrls[0] ?? null,
  })
}

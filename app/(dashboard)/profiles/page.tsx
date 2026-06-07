import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { ProfilesClient } from "@/components/profiles/profiles-client"
import { createSignedImageUrlsMap } from "@/lib/storage/images"
import type { KidProfile } from "@/types"

export default async function ProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const accountId = userRow?.account_id ?? ""

  const { data: profiles } = userRow
    ? await service
        .from("kid_profiles")
        .select(
          "id, account_id, name, age, age_months, gender, appearance, personality_tags, toy, prompt_summary, " +
          "reference_image_path, reference_image_url, " +
          "character_illustration_path, character_illustration_url, " +
          "toy_reference_image_path, toy_reference_image_url, " +
          "combined_reference_path, combined_reference_url, " +
          "illustration_status, illustration_error, " +
          "deleted_at, created_at, updated_at"
        )
        .eq("account_id", userRow.account_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [] }

  const rows = (profiles ?? []) as unknown as KidProfile[]

  const pathsToSign = rows.flatMap((p) => [
    p.combined_reference_path,
    p.character_illustration_path,
    p.toy_reference_image_path,
    p.reference_image_path,
  ]).filter((p): p is string => Boolean(p))

  const signedUrlsByPath = await createSignedImageUrlsMap(service, pathsToSign)

  function signedOrFallback(path: string | null | undefined, fallback: string | null | undefined): string | null {
    return (path && signedUrlsByPath.get(path)) ?? fallback ?? null
  }

  const resolvedProfiles = rows.map((profile) => ({
    ...profile,
    avatarUrl: signedOrFallback(profile.combined_reference_path, null)
      ?? signedOrFallback(profile.character_illustration_path, null)
      ?? signedOrFallback(profile.reference_image_path, profile.reference_image_url),
    reference_image_url: signedOrFallback(profile.reference_image_path, profile.reference_image_url),
    character_illustration_url: signedOrFallback(
      profile.character_illustration_path,
      profile.character_illustration_url,
    ),
    toy_reference_image_url: signedOrFallback(
      profile.toy_reference_image_path,
      profile.toy_reference_image_url,
    ),
    combined_reference_url: signedOrFallback(
      profile.combined_reference_path,
      profile.combined_reference_url,
    ),
  }))

  return <ProfilesClient profiles={resolvedProfiles} accountId={accountId} />
}

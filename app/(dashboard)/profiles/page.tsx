import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { ProfilesClient } from "@/components/profiles/profiles-client"
import { createSignedImageUrlsMap } from "@/lib/storage/images"

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

  const { data: profiles } = userRow
    ? await service
        .from("kid_profiles")
        .select("id, name, age, age_months, gender, appearance, personality_tags, toy, reference_image_path, reference_image_url, character_illustration_path, combined_reference_path")
        .eq("account_id", userRow.account_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [] }

  const rows = profiles ?? []
  const pathsToSign = rows.flatMap((p) => [
    p.combined_reference_path,
    p.character_illustration_path,
    p.reference_image_path,
  ]).filter((p): p is string => Boolean(p))
  const signedUrlsByPath = await createSignedImageUrlsMap(service, pathsToSign)

  const resolvedProfiles = rows.map((profile) => ({
    ...profile,
    reference_image_url: (() => {
      const pfpPath = profile.combined_reference_path
      const charPath = profile.character_illustration_path
      const refPath = profile.reference_image_path
      return (pfpPath && signedUrlsByPath.get(pfpPath))
        ?? (charPath && signedUrlsByPath.get(charPath))
        ?? (refPath && signedUrlsByPath.get(refPath))
        ?? profile.reference_image_url
        ?? null
    })(),
  }))

  return <ProfilesClient profiles={resolvedProfiles} />
}

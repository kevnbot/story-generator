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
        .select("id, name, age, age_months, gender, appearance, personality_tags, toy, reference_image_path, reference_image_url")
        .eq("account_id", userRow.account_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [] }

  const rows = profiles ?? []
  const signedUrlsByPath = await createSignedImageUrlsMap(
    service,
    rows.map((p) => p.reference_image_path).filter((p): p is string => Boolean(p))
  )

  const resolvedProfiles = rows.map((profile) => ({
    ...profile,
    reference_image_url: profile.reference_image_path
      ? signedUrlsByPath.get(profile.reference_image_path) ?? profile.reference_image_url
      : profile.reference_image_url,
  }))

  return <ProfilesClient profiles={resolvedProfiles} />
}

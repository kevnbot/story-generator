import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { createSignedImageUrlsMap } from "@/lib/storage/images"
import { WorkbenchClient } from "@/components/admin/workbench/WorkbenchClient"

export const metadata = {
  title: "Prompt Workbench | Admin",
}

export default async function WorkbenchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isPlatformAdmin(user.id))) redirect("/generate")

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const accountId = userRow?.account_id

  const [profilesResult, storyTypesResult, artStylesResult] = await Promise.all([
    accountId
      ? service
          .from("kid_profiles")
          .select("id, name, age, age_months, gender, appearance, personality_tags, toy, reference_image_path, reference_image_url, combined_reference_path, character_illustration_path, illustration_status")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    service
      .from("story_types")
      .select("id, name, description, occasion_required, extra_input_label, extra_input_hint")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    service
      .from("art_styles")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ])

  const rawProfiles = profilesResult.data ?? []
  const signedUrlsByPath = await createSignedImageUrlsMap(
    service,
    rawProfiles
      .map((p) => p.reference_image_path)
      .filter((path): path is string => Boolean(path))
  )
  const profiles = rawProfiles.map((p) => ({
    ...p,
    reference_image_url: p.reference_image_path
      ? signedUrlsByPath.get(p.reference_image_path) ?? p.reference_image_url
      : p.reference_image_url,
  }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Prompt Workbench</h1>
      </div>

      <WorkbenchClient
        profiles={profiles}
        storyTypes={storyTypesResult.data ?? []}
        artStyles={artStylesResult.data ?? []}
      />
    </div>
  )
}

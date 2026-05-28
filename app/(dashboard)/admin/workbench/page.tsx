import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
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
          .select("id, name, age, age_months, reference_image_path, combined_reference_path, character_illustration_path")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    service
      .from("story_types")
      .select("id, name, description, extra_input_label, extra_input_hint")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    service
      .from("art_styles")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Prompt Workbench</h1>
      </div>

      <WorkbenchClient
        profiles={profilesResult.data ?? []}
        storyTypes={storyTypesResult.data ?? []}
        artStyles={artStylesResult.data ?? []}
      />
    </div>
  )
}

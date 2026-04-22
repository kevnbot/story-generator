import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { StoryGenerator } from "@/components/generate/story-generator"

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ parentStoryId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { parentStoryId } = await searchParams

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const [profilesResult, templatesResult, accountResult, parentResult, artStylesResult] = await Promise.all([
    userRow
      ? service
          .from("kid_profiles")
          .select("id, name, age, age_months")
          .eq("account_id", userRow.account_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    service
      .from("story_templates")
      .select("id, name, description, credits_cost")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    userRow
      ? service
          .from("accounts")
          .select("credit_balance")
          .eq("id", userRow.account_id)
          .single()
      : Promise.resolve({ data: null }),
    parentStoryId && userRow
      ? service
          .from("stories")
          .select("id, title, story_template_id, generation_params")
          .eq("id", parentStoryId)
          .eq("account_id", userRow.account_id)
          .is("deleted_at", null)
          .single()
      : Promise.resolve({ data: null }),
    service
      .from("art_styles")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ])

  const parent = parentResult.data
  const defaultProfileIds: string[] = parent
    ? (parent.generation_params?.kid_profile_ids ?? (parent.generation_params?.kid_profile_id ? [parent.generation_params.kid_profile_id] : []))
    : []
  const defaultTemplateId: string = parent?.story_template_id ?? ""

  const artStyles = artStylesResult.data ?? []

  return (
    <StoryGenerator
      profiles={profilesResult.data ?? []}
      templates={templatesResult.data ?? []}
      artStyles={artStyles}
      credits={accountResult.data?.credit_balance ?? 0}
      imagesAvailable={!!process.env.FAL_KEY}
      parentStoryId={parent?.id}
      parentStoryTitle={parent?.title}
      defaultProfileIds={defaultProfileIds}
      defaultTemplateId={defaultTemplateId}
    />
  )
}

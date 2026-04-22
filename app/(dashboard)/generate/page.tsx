import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { StoryGenerator } from "@/components/generate/story-generator"

export default async function GeneratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const [profilesResult, templatesResult, accountResult] = await Promise.all([
    userRow
      ? service
          .from("kid_profiles")
          .select("id, name, age")
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
  ])

  return (
    <StoryGenerator
      profiles={profilesResult.data ?? []}
      templates={templatesResult.data ?? []}
      credits={accountResult.data?.credit_balance ?? 0}
    />
  )
}

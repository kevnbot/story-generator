import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { StoriesClient } from "@/components/stories/stories-client"

export default async function StoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const { data: stories } = userRow
    ? await service
        .from("stories")
        .select("id, title, content, has_images, version_number, parent_story_id, credits_used, created_at, generation_params")
        .eq("account_id", userRow.account_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] }

  return <StoriesClient stories={stories ?? []} />
}

import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { ProfilesClient } from "@/components/profiles/profiles-client"

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
        .select("id, name, age, personality_tags, toy")
        .eq("account_id", userRow.account_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [] }

  return <ProfilesClient profiles={profiles ?? []} />
}

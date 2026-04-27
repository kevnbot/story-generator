import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Story, KidProfile, StoryTemplate } from "@/types"
import StoryLibrary from "@/components/library/StoryLibrary"

export const metadata = {
  title: "Library | Story Generator",
}

export default async function LibraryPage() {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch stories, profiles, and templates in parallel
  const [storiesRes, profilesRes, templatesRes] = await Promise.all([
    supabase
      .from("stories")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("kid_profiles")
      .select("*")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("story_templates")
      .select("id, name, description, credits_cost, is_active")
      .eq("is_active", true)
      .order("name"),
  ])

  // Graceful handling — show empty state rather than crashing if DB errors
  const stories: Story[]         = storiesRes.data  ?? []
  const profiles: KidProfile[]   = profilesRes.data ?? []
  const templates = (templatesRes.data ?? []) as StoryTemplate[]

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <StoryLibrary
        stories={stories}
        profiles={profiles}
        templates={templates}
      />
    </main>
  )
}

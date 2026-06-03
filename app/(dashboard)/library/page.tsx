import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Story, KidProfile, StoryTemplate } from "@/types"
import StoryLibrary from "@/components/library/StoryLibrary"
import { createSignedImageUrlsMap, resolveStoryImagesForUi } from "@/lib/storage/images"

export const metadata = {
  title: "Your Story Shelf | My Genie Stories",
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
  const service = createServiceClient()
  const signedUrlsByPath = await createSignedImageUrlsMap(
    service,
    stories.flatMap((story) => (story.images ?? []).map((image) => image.path).filter((p): p is string => Boolean(p)))
  )
  const resolvedStories = stories.map((story) => ({
    ...story,
    images: resolveStoryImagesForUi(story.images ?? [], signedUrlsByPath),
  }))

  return (
    <StoryLibrary
      stories={resolvedStories}
      profiles={profiles}
      templates={templates}
    />
  )
}

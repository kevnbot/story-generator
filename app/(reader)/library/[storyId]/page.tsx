import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import type { Story, KidProfile, StoryTemplate } from "@/types"
import BookReader from "@/components/library/BookReader"
import { fillPromptTemplateMulti } from "@/lib/ai/prompt-builder"
import { createSignedImageUrlsMap, resolveStoryImagesForUi } from "@/lib/storage/images"

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ storyId: string }>
}) {
  const { storyId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: row } = await supabase
    .from("stories")
    .select(`
      *,
      story_templates ( system_prompt, user_prompt_template ),
      kid_profiles ( id, name, age, age_months, gender, appearance, personality_tags, toy, prompt_summary, reference_image_path, reference_image_url, deleted_at, created_at, updated_at, account_id )
    `)
    .eq("id", storyId)
    .is("deleted_at", null)
    .single()

  if (!row) notFound()

  const r = row as typeof row & {
    story_templates: Pick<StoryTemplate, "system_prompt" | "user_prompt_template"> | null
    kid_profiles: KidProfile | null
  }

  let generation_params = (r.generation_params ?? {}) as Story["generation_params"]

  if (!generation_params.system_prompt && r.story_templates) {
    generation_params = { ...generation_params, system_prompt: r.story_templates.system_prompt }
  }

  if (!generation_params.user_prompt && r.story_templates && r.kid_profiles) {
    generation_params = {
      ...generation_params,
      user_prompt: fillPromptTemplateMulti(r.story_templates.user_prompt_template, [r.kid_profiles]),
    }
  }

  if (!generation_params.kid_names?.length && r.kid_profiles) {
    generation_params = { ...generation_params, kid_names: [r.kid_profiles.name] }
  }

  const service = createServiceClient()
  const signedUrlsByPath = await createSignedImageUrlsMap(
    service,
    ((r.images ?? []) as Story["images"]).map((image) => image.path).filter((p): p is string => Boolean(p))
  )

  const story: Story = {
    ...(r as unknown as Story),
    generation_params,
    images: resolveStoryImagesForUi((r.images ?? []) as Story["images"], signedUrlsByPath),
  }

  return <BookReader story={story} />
}

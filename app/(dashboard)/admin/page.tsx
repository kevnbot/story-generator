import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Story, KidProfile, StoryTemplate } from "@/types"
import PromptViewer from "@/components/admin/PromptViewer"
import { fillPromptTemplateMulti } from "@/lib/ai/prompt-builder"

export const metadata = {
  title: "Prompt Log | Admin",
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const { data: rows } = userRow
    ? await service
        .from("stories")
        .select(`
          id, title, has_images, created_at, generation_params,
          story_templates ( system_prompt, user_prompt_template ),
          kid_profiles ( id, name, age, age_months, gender, appearance, personality_tags, toy, prompt_summary, deleted_at, created_at, updated_at, account_id )
        `)
        .eq("account_id", userRow.account_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] }

  // For stories missing stored prompts, reconstruct from the template and primary profile.
  // The reconstructed user_prompt omits any injected page-count / story-description / feedback
  // context since that wasn't captured, but it's a close approximation.
  const stories: Story[] = (rows ?? []).map((row) => {
    const r = row as typeof row & {
      story_templates: Pick<StoryTemplate, "system_prompt" | "user_prompt_template"> | null
      kid_profiles: KidProfile | null
    }

    let params = (r.generation_params ?? {}) as Story["generation_params"]

    if (!params.system_prompt && r.story_templates) {
      params = { ...params, system_prompt: r.story_templates.system_prompt }
    }

    if (!params.user_prompt && r.story_templates && r.kid_profiles) {
      params = {
        ...params,
        user_prompt: fillPromptTemplateMulti(r.story_templates.user_prompt_template, [r.kid_profiles]),
      }
    }

    if (!params.kid_names?.length && r.kid_profiles) {
      params = { ...params, kid_names: [r.kid_profiles.name] }
    }

    return {
      id: r.id,
      title: r.title,
      has_images: r.has_images,
      created_at: r.created_at,
      generation_params: params,
    } as Story
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Prompt Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generation prompts for the {stories.length} most recent stories. Expand a row to see all prompts sent.
        </p>
      </div>

      <PromptViewer stories={stories} />
    </div>
  )
}

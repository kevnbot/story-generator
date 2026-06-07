import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Story, KidProfile, StoryTemplate } from "@/types"
import PromptViewer, { type PromptLogRow } from "@/components/admin/PromptViewer"
import { fillPromptTemplateMulti } from "@/lib/ai/prompt-builder"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"

type OwnerRow = {
  account_id: string
  display_name: string | null
  email: string
}

export const metadata = {
  title: "Prompt Log | Admin",
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isPlatformAdmin(user.id))) redirect("/generate")

  const service = createServiceClient()

  const { data: rows } = await service
    .from("stories")
    .select(`
      id, title, has_images, created_at, generation_params, account_id,
      story_templates ( system_prompt, user_prompt_template ),
      kid_profiles ( id, name, age, age_months, gender, appearance, personality_tags, toy, prompt_summary, reference_image_path, reference_image_url, deleted_at, created_at, updated_at, account_id )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200)

  // Resolve the account owner for each story so the log can be searched/sorted by owner.
  const accountIds = Array.from(
    new Set((rows ?? []).map((row) => (row as { account_id: string }).account_id)),
  )
  const { data: ownerRows } = accountIds.length
    ? await service
        .from("users")
        .select("account_id, display_name, email")
        .in("account_id", accountIds)
        .eq("role", "owner")
        .is("deleted_at", null)
    : { data: [] }

  const owners = new Map<string, OwnerRow>()
  for (const owner of (ownerRows ?? []) as OwnerRow[]) {
    if (!owners.has(owner.account_id)) owners.set(owner.account_id, owner)
  }

  // For stories missing stored prompts, reconstruct from the template and primary profile.
  // The reconstructed user_prompt omits any injected page-count / story-description / feedback
  // context since that wasn't captured, but it's a close approximation.
  const promptRows: PromptLogRow[] = (rows ?? []).map((row) => {
    const r = row as typeof row & {
      account_id: string
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

    const owner = owners.get(r.account_id)

    return {
      story: {
        id: r.id,
        title: r.title,
        has_images: r.has_images,
        created_at: r.created_at,
        generation_params: params,
      } as Story,
      ownerName: owner?.display_name || owner?.email || "—",
      ownerEmail: owner?.email ?? null,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Prompt Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generation prompts for the {promptRows.length} most recent stories. Search by title or owner, sort, and expand a row to see all prompts sent.
        </p>
      </div>

      <PromptViewer rows={promptRows} />
    </div>
  )
}

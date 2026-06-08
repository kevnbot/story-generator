import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import type { Story, KidProfile } from "@/types"
import BookReader from "@/components/library/BookReader"
import { createSignedImageUrlsMap, resolveStoryImagesForUi } from "@/lib/storage/images"

export const metadata = {
  title: "A story to read",
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ mode?: string; page?: string }>
}) {
  const { token } = await params
  const sp = await searchParams
  const initialStoryMode = sp.mode === "story"
  const parsedPage = Number.parseInt(sp.page ?? "", 10)
  const initialPage = Number.isNaN(parsedPage) || parsedPage < 0 ? 0 : parsedPage

  // Public, no-auth read: only resolves a published, non-deleted story whose
  // unguessable token matches. Anything else 404s.
  const service = createServiceClient()
  const { data: row } = await service
    .from("stories")
    .select(`
      *,
      kid_profiles ( id, name, age, age_months, gender, appearance, personality_tags, toy, prompt_summary, reference_image_path, reference_image_url, deleted_at, created_at, updated_at, account_id )
    `)
    .eq("share_token", token)
    .eq("is_published", true)
    .is("deleted_at", null)
    .single()

  if (!row) notFound()

  const r = row as typeof row & { kid_profiles: KidProfile | null }

  const signedUrlsByPath = await createSignedImageUrlsMap(
    service,
    ((r.images ?? []) as Story["images"]).map((image) => image.path).filter((p): p is string => Boolean(p))
  )

  const story: Story = {
    ...(r as unknown as Story),
    // Never expose generation prompts / internal params on a public page.
    generation_params: {} as Story["generation_params"],
    images: resolveStoryImagesForUi((r.images ?? []) as Story["images"], signedUrlsByPath),
  }

  return (
    <BookReader
      story={story}
      initialPage={initialPage}
      initialStoryMode={initialStoryMode}
      canShare={false}
      publicView={true}
    />
  )
}

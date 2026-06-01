import { notFound, redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { createSignedImageUrlsMap, resolveStoryImagesForUi } from "@/lib/storage/images"
import { WorkbenchClient } from "@/components/admin/workbench/WorkbenchClient"
import {
  buildWorkbenchInitialStory,
  getWorkbenchSourceProfileIds,
  type WorkbenchInitialStory,
  type WorkbenchProfile,
  type WorkbenchResolvedStoryImage,
} from "@/lib/admin/workbench-preload"
import type { StoryImage } from "@/types"

export const metadata = {
  title: "Prompt Workbench | Admin",
}

type WorkbenchPageProps = {
  searchParams?: Promise<{ storyId?: string | string[] }>
}

type StoryRow = {
  id: string
  title: string
  account_id: string
  user_id: string
  kid_profile_id: string | null
  parent_story_id: string | null
  has_images: boolean
  content: string
  images: StoryImage[]
  generation_params: Record<string, unknown> | null
  created_at: string
}

const PROFILE_SELECT =
  "id, account_id, name, age, age_months, gender, appearance, personality_tags, toy, " +
  "reference_image_path, reference_image_url, " +
  "combined_reference_path, combined_reference_url, " +
  "character_illustration_path, character_illustration_url, illustration_status, deleted_at, created_at"

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function profileImagePaths(profiles: WorkbenchProfile[]): string[] {
  return profiles
    .flatMap((p) => [
      p.combined_reference_path,
      p.character_illustration_path,
      p.reference_image_path,
    ])
    .filter((path): path is string => Boolean(path))
}

function withSignedProfileUrls(
  profiles: WorkbenchProfile[],
  signedUrlsByPath: Map<string, string>,
  sourceProfileIds: string[] = []
): WorkbenchProfile[] {
  const sourceProfileIdSet = new Set(sourceProfileIds)

  return profiles.map((p) => ({
    ...p,
    is_source_only: Boolean(p.deleted_at && sourceProfileIdSet.has(p.id)),
    reference_image_url: p.reference_image_path
      ? signedUrlsByPath.get(p.reference_image_path) ?? p.reference_image_url
      : p.reference_image_url,
    character_illustration_url: p.character_illustration_path
      ? signedUrlsByPath.get(p.character_illustration_path) ?? p.character_illustration_url
      : p.character_illustration_url,
    combined_reference_url: p.combined_reference_path
      ? signedUrlsByPath.get(p.combined_reference_path) ?? p.combined_reference_url
      : p.combined_reference_url,
  }))
}

async function loadDefaultProfiles(service: ReturnType<typeof createServiceClient>, accountId: string | undefined) {
  if (!accountId) return []

  const { data } = await service
    .from("kid_profiles")
    .select(PROFILE_SELECT)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  return ((data ?? []) as unknown) as WorkbenchProfile[]
}

async function loadSourceStoryContext({
  service,
  storyId,
  storyTypes,
  artStyles,
}: {
  service: ReturnType<typeof createServiceClient>
  storyId: string
  storyTypes: Awaited<ReturnType<typeof loadStoryTypes>>
  artStyles: Awaited<ReturnType<typeof loadArtStyles>>
}): Promise<{ profiles: WorkbenchProfile[]; initialStory: WorkbenchInitialStory }> {
  const { data: storyData } = await service
    .from("stories")
    .select("id, title, account_id, user_id, kid_profile_id, parent_story_id, has_images, content, images, generation_params, created_at")
    .eq("id", storyId)
    .is("deleted_at", null)
    .single()

  if (!storyData) notFound()

  const story = storyData as unknown as StoryRow
  const sourceProfileIds = getWorkbenchSourceProfileIds(story.generation_params, story.kid_profile_id)

  const [activeProfilesResult, sourceProfilesResult, accountResult, ownerResult] = await Promise.all([
    service
      .from("kid_profiles")
      .select(PROFILE_SELECT)
      .eq("account_id", story.account_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    sourceProfileIds.length > 0
      ? service
          .from("kid_profiles")
          .select(PROFILE_SELECT)
          .eq("account_id", story.account_id)
          .in("id", sourceProfileIds)
      : Promise.resolve({ data: [] }),
    service
      .from("accounts")
      .select("id, name")
      .eq("id", story.account_id)
      .maybeSingle(),
    service
      .from("users")
      .select("id, email, display_name")
      .eq("id", story.user_id)
      .maybeSingle(),
  ])

  const profilesById = new Map<string, WorkbenchProfile>()
  for (const profile of ((activeProfilesResult.data ?? []) as unknown) as WorkbenchProfile[]) {
    profilesById.set(profile.id, profile)
  }
  for (const profile of ((sourceProfilesResult.data ?? []) as unknown) as WorkbenchProfile[]) {
    profilesById.set(profile.id, profile)
  }

  const rawProfiles = [...profilesById.values()]
  const imagePaths = [
    ...profileImagePaths(rawProfiles),
    ...((story.images ?? []) as StoryImage[])
      .map((image) => image.path)
      .filter((path): path is string => Boolean(path)),
  ]
  const signedUrlsByPath = await createSignedImageUrlsMap(service, imagePaths)
  const profiles = withSignedProfileUrls(rawProfiles, signedUrlsByPath, sourceProfileIds)
  const resolvedImages = resolveStoryImagesForUi(story.images ?? [], signedUrlsByPath)
    .map((image): WorkbenchResolvedStoryImage => ({
      url: image.url,
      caption: image.caption,
      scene_index: image.scene_index,
    }))
  const archivedProfileNames = profiles
    .filter((profile) => profile.deleted_at && sourceProfileIds.includes(profile.id))
    .map((profile) => profile.name)

  const account = accountResult.data as { id: string; name: string | null } | null
  const owner = ownerResult.data as { id: string; email: string | null; display_name: string | null } | null

  return {
    profiles,
    initialStory: buildWorkbenchInitialStory({
      story,
      sourceContext: {
        storyId: story.id,
        storyTitle: story.title,
        storyCreatedAt: story.created_at,
        accountId: story.account_id,
        accountName: account?.name ?? null,
        userId: story.user_id,
        userEmail: owner?.email ?? null,
        userDisplayName: owner?.display_name ?? null,
      },
      storyTypes,
      artStyles,
      sourceProfileIds,
      archivedProfileNames,
      resolvedImages,
    }),
  }
}

async function loadStoryTypes(service: ReturnType<typeof createServiceClient>) {
  const { data } = await service
    .from("story_types")
    .select("id, name, description, occasion_required, extra_input_label, extra_input_hint, system_prompt_suffix, structure_template, page_guidance")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  return data ?? []
}

async function loadArtStyles(service: ReturnType<typeof createServiceClient>) {
  const { data } = await service
    .from("art_styles")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  return data ?? []
}

export default async function WorkbenchPage({ searchParams }: WorkbenchPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isPlatformAdmin(user.id))) redirect("/generate")

  const service = createServiceClient()
  const query = searchParams ? await searchParams : {}
  const storyId = firstQueryValue(query.storyId)

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const accountId = userRow?.account_id

  const [storyTypes, artStyles] = await Promise.all([
    loadStoryTypes(service),
    loadArtStyles(service),
  ])

  let profiles: WorkbenchProfile[]
  let initialStory: WorkbenchInitialStory | null = null

  if (storyId) {
    const source = await loadSourceStoryContext({ service, storyId, storyTypes, artStyles })
    profiles = source.profiles
    initialStory = source.initialStory
  } else {
    const rawProfiles = await loadDefaultProfiles(service, accountId)
    const signedUrlsByPath = await createSignedImageUrlsMap(service, profileImagePaths(rawProfiles))
    profiles = withSignedProfileUrls(rawProfiles, signedUrlsByPath)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Prompt Workbench</h1>
      </div>

      <WorkbenchClient
        profiles={profiles}
        storyTypes={storyTypes}
        artStyles={artStyles}
        initialStory={initialStory}
      />
    </div>
  )
}

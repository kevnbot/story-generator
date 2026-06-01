import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { copyRemoteImageToStoragePath, buildStoryImagePath } from "@/lib/storage/images"
import { config } from "@/lib/config"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"
import type { StoryImage } from "@/types"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const title = body?.title as string | undefined
  const storyPages = body?.storyPages as string[] | undefined
  const images = body?.images as { url: string; isErrorPlaceholder: boolean; pageIndex: number }[] | undefined
  const generationParams = body?.generationParams as Record<string, unknown> | undefined
  const profileIds = body?.profileIds as string[] | undefined
  const storyTypeId = body?.storyTypeId as string | undefined
  const artStyleId = body?.artStyleId as string | undefined
  const rawLength = body?.storyLength as string | undefined
  const textDensity = body?.textDensity as string | undefined
  const includeImages = (body?.includeImages as boolean | undefined) ?? false

  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
  if (!storyPages?.length) return NextResponse.json({ error: "storyPages required" }, { status: 400 })
  if (!profileIds?.length) return NextResponse.json({ error: "profileIds required" }, { status: 400 })

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const [accountResult, templateResult] = await Promise.all([
    service
      .from("accounts")
      .select("credit_balance")
      .eq("id", userRow.account_id)
      .single(),
    service
      .from("story_templates")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single(),
  ])

  if (!accountResult.data) return NextResponse.json({ error: "Account not found" }, { status: 404 })
  if (!templateResult.data) return NextResponse.json({ error: "No active story template found" }, { status: 404 })

  const account = accountResult.data
  const templateId = templateResult.data.id

  const storyLength: StoryLength = (rawLength && rawLength in STORY_LENGTHS) ? rawLength as StoryLength : "medium"
  const lengthConfig = STORY_LENGTHS[storyLength]
  const baseCredits = await config.creditsPerStory()
  const imageCost = includeImages ? lengthConfig.imageCost : 0
  const creditsNeeded = baseCredits + imageCost

  if (account.credit_balance < creditsNeeded) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 400 })
  }

  // Reconstruct content with page markers so the library reader can split correctly
  const content = storyPages.map((text, i) => `--- Page ${i + 1} ---\n${text}`).join("\n\n")

  const jobId = `workbench-${Date.now()}`
  const primaryProfileId = profileIds[0]
  const storyImages: StoryImage[] = []

  for (const img of images ?? []) {
    if (img.isErrorPlaceholder) {
      storyImages.push({ url: "/images/story-image-error.svg", caption: null, scene_index: img.pageIndex })
      continue
    }
    const storedPath = await copyRemoteImageToStoragePath({
      supabase: service,
      sourceUrl: img.url,
      buildPath: (ext) => buildStoryImagePath(userRow.account_id, jobId, img.pageIndex, ext),
    })
    if (storedPath) {
      storyImages.push({ path: storedPath, caption: null, scene_index: img.pageIndex })
    } else {
      storyImages.push({ url: img.url, caption: null, scene_index: img.pageIndex })
    }
  }

  const { data: story } = await service
    .from("stories")
    .insert({
      account_id: userRow.account_id,
      user_id: user.id,
      kid_profile_id: primaryProfileId,
      story_template_id: templateId,
      parent_story_id: null,
      version_number: 1,
      has_images: storyImages.length > 0,
      title: title.trim(),
      content,
      images: storyImages,
      generation_params: {
        ...(generationParams ?? {}),
        kid_profile_id: primaryProfileId,
        kid_profile_ids: profileIds,
        story_template_id: templateId,
        story_type_id: storyTypeId ?? undefined,
        art_style_id: artStyleId ?? undefined,
        story_length: storyLength,
        text_density: textDensity ?? undefined,
        custom_title: title.trim(),
        include_images: includeImages,
        workbench: true,
      },
      credits_used: creditsNeeded,
    })
    .select("id")
    .single()

  await Promise.all([
    service
      .from("accounts")
      .update({ credit_balance: account.credit_balance - creditsNeeded })
      .eq("id", userRow.account_id),
    service
      .from("credit_transactions")
      .insert({
        account_id: userRow.account_id,
        user_id: user.id,
        amount: -creditsNeeded,
        type: "spend",
        description: `Workbench story: ${title.trim()}`,
      }),
  ])

  return NextResponse.json({ storyId: story?.id ?? null, creditsUsed: creditsNeeded })
}

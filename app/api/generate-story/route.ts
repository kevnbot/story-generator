import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { generateStoryStream, extractStoryTitle } from "@/lib/ai/story"
import { generateStoryImage } from "@/lib/ai/image"
import { fillPromptTemplateMulti, joinNames } from "@/lib/ai/prompt-builder"
import { checkStoryRateLimit } from "@/lib/rate-limit"
import { config } from "@/lib/config"
import type { KidProfile, StoryTemplate, StoryImage } from "@/types"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const profileIds    = body?.profileIds    as string[] | undefined
  const templateId    = body?.templateId    as string   | undefined
  const rawLength        = body?.storyLength       as string   | undefined
  const storyLength: StoryLength = (rawLength && rawLength in STORY_LENGTHS) ? rawLength as StoryLength : "short"
  const storyDescription = body?.storyDescription as string   | undefined
  const customTitle      = body?.customTitle      as string   | undefined
  const includeImages    = body?.includeImages    as boolean  ?? false
  const parentStoryId    = body?.parentStoryId    as string   | undefined
  const feedback         = body?.feedback         as string   | undefined

  if (!profileIds?.length || !templateId) {
    return NextResponse.json({ error: "profileIds and templateId required" }, { status: 400 })
  }

  const { allowed } = await checkStoryRateLimit(user.id)
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { data: account } = await service
    .from("accounts")
    .select("credit_balance")
    .eq("id", userRow.account_id)
    .single()

  const lengthConfig = STORY_LENGTHS[storyLength]
  const imagesEnabled = includeImages && !!process.env.FAL_KEY
  const baseCredits = await config.creditsPerStory()
  const creditsNeeded = baseCredits + (imagesEnabled ? lengthConfig.imageCost : 0)

  if (!account || account.credit_balance < creditsNeeded) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
  }

  // Fetch profiles and template in parallel; also fetch parent story if versioning
  const [profilesResult, { data: template }, parentResult] = await Promise.all([
    service
      .from("kid_profiles")
      .select("*")
      .in("id", profileIds)
      .eq("account_id", userRow.account_id)
      .is("deleted_at", null),
    service
      .from("story_templates")
      .select("*")
      .eq("id", templateId)
      .eq("is_active", true)
      .single(),
    parentStoryId
      ? service
          .from("stories")
          .select("id, content, version_number")
          .eq("id", parentStoryId)
          .eq("account_id", userRow.account_id)
          .is("deleted_at", null)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const profiles = profilesResult.data as KidProfile[] | null
  if (!profiles?.length) return NextResponse.json({ error: "Profiles not found" }, { status: 404 })
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  if (parentStoryId && !parentResult.data) {
    return NextResponse.json({ error: "Parent story not found" }, { status: 404 })
  }

  // Determine version number
  let versionNumber = 1
  if (parentStoryId && parentResult.data) {
    const { data: siblings } = await service
      .from("stories")
      .select("version_number")
      .eq("parent_story_id", parentStoryId)
      .order("version_number", { ascending: false })
      .limit(1)
    versionNumber = (siblings?.[0]?.version_number ?? 1) + 1
  }

  const t = template as StoryTemplate
  let userPrompt = fillPromptTemplateMulti(t.user_prompt_template, profiles)
  const imagePrompt = fillPromptTemplateMulti(t.image_prompt_template, profiles)
  const systemPrompt = t.system_prompt

  // Inject page count so Claude structures the story correctly
  userPrompt = `${userPrompt}\n\nWrite this as exactly ${lengthConfig.pages} pages. Each page should be a short paragraph of 2-3 sentences suitable for a children's picture book.`

  // Inject the user's story description
  if (storyDescription?.trim()) {
    userPrompt = `${userPrompt}\n\nStory request: ${storyDescription.trim()}`
  }

  // Inject revision context when creating a version with feedback
  if (parentResult.data?.content && feedback?.trim()) {
    userPrompt = `${userPrompt}\n\n---\n\nPrevious version of this story for reference:\n\n${parentResult.data.content}\n\n---\n\nFeedback and changes to incorporate in this new version: ${feedback.trim()}`
  }

  const primaryProfileId = profiles[0].id

  const { data: job } = await service
    .from("generation_jobs")
    .insert({
      account_id: userRow.account_id,
      user_id: user.id,
      kid_profile_id: primaryProfileId,
      story_template_id: templateId,
      status: "generating",
      credits_held: creditsNeeded,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!job) return NextResponse.json({ error: "Failed to start generation" }, { status: 500 })

  const encoder = new TextEncoder()
  let fullText = ""

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))

      try {
        for await (const chunk of generateStoryStream(systemPrompt, userPrompt)) {
          fullText += chunk
          send({ type: "chunk", text: chunk })
        }

        const primaryName = profiles.length === 1
          ? profiles[0].name
          : joinNames(profiles.map(p => p.name))

        const title = customTitle?.trim() || await extractStoryTitle(fullText, primaryName)

        // Generate images in parallel if requested and FAL_KEY is available
        const images: StoryImage[] = []
        if (imagesEnabled) {
          send({ type: "status", message: `Generating ${lengthConfig.imageCount} images...` })
          const urls = await Promise.all(
            Array.from({ length: lengthConfig.imageCount }, (_, i) =>
              generateStoryImage(`${imagePrompt} (page ${i + 1} of ${lengthConfig.imageCount})`)
            )
          )
          urls.forEach((url, i) => {
            if (url) images.push({ url, caption: null, scene_index: i })
          })
        }

        const { data: story } = await service
          .from("stories")
          .insert({
            account_id: userRow.account_id,
            user_id: user.id,
            kid_profile_id: primaryProfileId,
            story_template_id: templateId,
            job_id: job.id,
            parent_story_id: parentStoryId ?? null,
            version_number: versionNumber,
            has_images: images.length > 0,
            title,
            content: fullText,
            images,
            generation_params: {
              kid_profile_id: primaryProfileId,
              kid_profile_ids: profiles.map(p => p.id),
              kid_names: profiles.map(p => p.name),
              story_template_id: templateId,
              prompt_summary: profiles.map(p => p.prompt_summary).join(" "),
              system_prompt: systemPrompt,
              user_prompt: userPrompt,
              image_prompt: imagePrompt,
              model: "claude-opus-4-7",
              image_model: imagesEnabled ? "fal-ai/flux/schnell" : "",
            },
            credits_used: creditsNeeded,
          })
          .select()
          .single()

        await Promise.all([
          service
            .from("accounts")
            .update({ credit_balance: account.credit_balance - creditsNeeded })
            .eq("id", userRow.account_id),
          service.from("credit_transactions").insert({
            account_id: userRow.account_id,
            user_id: user.id,
            amount: -creditsNeeded,
            type: "spend",
            description: `Story: ${title}`,
          }),
          service
            .from("generation_jobs")
            .update({ status: "complete", completed_at: new Date().toISOString() })
            .eq("id", job.id),
        ])

        send({ type: "done", storyId: story?.id ?? null, title, hasImages: images.length > 0 })
        controller.close()
      } catch (err) {
        await service
          .from("generation_jobs")
          .update({ status: "failed", error_message: String(err) })
          .eq("id", job.id)
        send({ type: "error", message: "Story generation failed. Please try again." })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

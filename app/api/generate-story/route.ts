import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { generateStoryStream, extractStoryTitle, splitStoryPages, extractStoryVisuals } from "@/lib/ai/story"
import { generateStoryImageWithReference, generateGroupReferenceImage, applyArtStyleToReference } from "@/lib/ai/image"
import { joinNames, buildCharacterAnchor, buildCharacterAnchorSlim } from "@/lib/ai/prompt-builder"
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
  const artStyleId    = body?.artStyleId    as string   | undefined
  const rawLength        = body?.storyLength       as string   | undefined
  const storyLength: StoryLength = (rawLength && rawLength in STORY_LENGTHS) ? rawLength as StoryLength : "short"
  const storyDescription = body?.storyDescription as string   | undefined
  const customTitle      = body?.customTitle      as string   | undefined
  const includeImages    = body?.includeImages    as boolean  ?? false
  const parentStoryId    = body?.parentStoryId    as string   | undefined
  const feedback         = body?.feedback         as string   | undefined

  if (!profileIds?.length) {
    return NextResponse.json({ error: "profileIds required" }, { status: 400 })
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

  // Fetch profiles, template, parent story, and default art style in parallel
  const [profilesResult, { data: template }, parentResult, { data: artStyle }] = await Promise.all([
    service
      .from("kid_profiles")
      .select("*")
      .in("id", profileIds)
      .eq("account_id", userRow.account_id)
      .is("deleted_at", null),
    service
      .from("story_templates")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
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
    artStyleId
      ? service
          .from("art_styles")
          .select("id, prompt_prefix")
          .eq("id", artStyleId)
          .eq("is_active", true)
          .maybeSingle()
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
  const systemPrompt = t.system_prompt

  // Age-calibrated language guidance based on the youngest child in the story
  const youngestAge = Math.min(...profiles.map(p => p.age))
  const ageGuidance = youngestAge <= 4
    ? "Use very simple words and short sentences a toddler can follow. Sensory details, gentle repetition, and playful sounds work well. Each page should feel like it can be read in one breath."
    : youngestAge <= 7
    ? "Use simple, clear language with short sentences. Stick to concrete actions and feelings. Avoid complex vocabulary or abstract ideas."
    : "You can use richer vocabulary and longer sentences. Include some emotional depth and a satisfying narrative arc."

  const primaryName = profiles.length === 1
    ? profiles[0].name
    : joinNames(profiles.map(p => p.name))

  // Character context — narrative-relevant fields only (name, age, gender, personality, toy).
  // Appearance is intentionally omitted: it doesn't affect story writing and is handled
  // separately by reference images for illustrations.
  const characterLines = profiles.map(p => {
    const attrs: string[] = []
    if (p.gender) attrs.push(p.gender)
    attrs.push(`${p.age} years old`)
    if (p.personality_tags.length > 0) attrs.push(p.personality_tags.join(", "))
    const toyName = p.toy?.name && p.toy.name !== "their favorite toy" ? p.toy.name : null
    if (toyName) {
      const toyFull = p.toy.description ? `${toyName} (${p.toy.description})` : toyName
      attrs.push(`toy: ${toyFull}`)
    }
    return `- ${p.name}: ${attrs.join(", ")}`
  }).join("\n")

  const characterLabel = profiles.length === 1 ? "Main character" : "Main characters"

  const personalityDirective = profiles.length === 1 && profiles[0].personality_tags.length > 0
    ? `\n\nLet ${profiles[0].name}'s personality (${profiles[0].personality_tags.join(", ")}) actively drive their choices and reactions throughout the story — not just appear in passing, but shape how they approach every problem and moment.`
    : profiles.length > 1
    ? `\n\nLet each character's personality actively drive their choices throughout the story — not just appear in passing, but shape how they approach problems and interact with each other.`
    : ""

  // Story request (what the user wants) comes before format rules so Claude
  // understands the intent before receiving structural constraints.
  let userPrompt = `${characterLabel}:\n${characterLines}`

  if (storyDescription?.trim()) {
    userPrompt = `${userPrompt}\n\nStory request: ${storyDescription.trim()}`
  }

  userPrompt = `${userPrompt}

---

Begin your response with "Title: [your story title]" on its own line, then write the story.

Write exactly ${lengthConfig.pages} pages. Separate each page with a line containing only "--- Page N ---" (e.g. "--- Page 1 ---", "--- Page 2 ---"). Each page should be 2-3 sentences.

${ageGuidance}

Each page must describe one clear visual moment — where the characters are, what they are doing, and what is physically around them. Avoid pages that are only internal thoughts, dialogue, or abstract feelings with no visual scene.${personalityDirective}`

  // Revision context when creating a new version with feedback
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
      story_template_id: t.id,
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

        // Extract title from Claude's output; fall back to a separate Haiku call if absent
        const titleLineMatch = fullText.match(/^Title:\s*(.+?)(?:\r?\n|$)/im)
        const embeddedTitle = titleLineMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""
        if (embeddedTitle) {
          fullText = fullText.replace(/^Title:\s*.+?(?:\r?\n)+/im, "").trim()
        }
        const title = customTitle?.trim() || embeddedTitle || await extractStoryTitle(fullText, primaryName)

        // Generate images if requested and FAL_KEY is available.
        // One Haiku call extracts consistent outfits + vivid per-page scenes from the finished story,
        // then each image prompt leads with the scene so the model prioritises it.
        const images: StoryImage[] = []
        let characterAnchor = ""
        let pagePrompts: string[] = []
        let visualsPrompt = ""

        if (imagesEnabled) {
          send({ type: "status", message: "Planning illustrations…" })

          const storyPages = splitStoryPages(fullText)
          const referenceProfileIds = new Set(profiles.filter(p => p.reference_image_url).map(p => p.id))
          const { outfits, scenes, prompt: vp } = await extractStoryVisuals(storyPages, profiles, referenceProfileIds)
          visualsPrompt = vp
          characterAnchor = buildCharacterAnchor(profiles, outfits)
          // Strip trailing comma/whitespace from prompt_prefix so it doesn't create
          // double-comma artifacts when composed into the full image prompt.
          const styleDescription = artStyle?.prompt_prefix
            ? artStyle.prompt_prefix.replace(/[,\s]+$/, "")
            : "children's picture book illustration"

          // Build a group reference image from all characters' stored profile references,
          // then convert it to the selected art style. This styled image becomes the
          // Kontext anchor for every page — so character consistency AND art style are
          // both carried through without either fighting the other.
          send({ type: "status", message: "Preparing character references…" })
          const groupReferenceUrl = await generateGroupReferenceImage(profiles, outfits)

          // Apply the selected art style to the group reference before using it as the
          // Kontext anchor. Without this step, Kontext would maintain the neutral FLUX/dev
          // style of the profile reference images and ignore the text-based style request.
          // Falls back to the unstyled reference if the style transfer call fails.
          send({ type: "status", message: "Applying art style…" })
          const referenceImageUrl = (groupReferenceUrl && artStyle?.prompt_prefix)
            ? await applyArtStyleToReference(groupReferenceUrl, styleDescription)
            : groupReferenceUrl

          // Fixed seed for the fallback FLUX/dev path so character features stay consistent
          // across pages when no Kontext reference image is available
          const storySeed = Math.floor(Math.random() * 2147483647)

          send({ type: "status", message: `Generating ${lengthConfig.imageCount} images…` })
          const humanRule = "All characters are human children. Toys are separate stuffed objects held in hands — children have no animal features, fur, tails, or ears."
          pagePrompts = Array.from({ length: lengthConfig.imageCount }, (_, i) => {
            const scene = scenes[i] ?? scenes[scenes.length - 1] ?? ""
            if (referenceImageUrl) {
              const slimAnchor = buildCharacterAnchorSlim(profiles, outfits, referenceProfileIds)
              return `${scene}. ${styleDescription}. ${slimAnchor}. Maintain all characters' exact appearances from the reference image. ${humanRule}`
            }
            return `${scene}. ${styleDescription}. ${characterAnchor}. ${humanRule} Consistent character design throughout.`
          })

          const urls = await Promise.all(pagePrompts.map(p => generateStoryImageWithReference(p, referenceImageUrl, storySeed)))
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
            story_template_id: t.id,
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
              story_template_id: t.id,
              prompt_summary: profiles.map(p => p.prompt_summary).join(" "),
              system_prompt: systemPrompt,
              user_prompt: userPrompt,
              image_prompt: characterAnchor,
              character_anchor: characterAnchor || undefined,
              visuals_prompt: pagePrompts.length > 0 ? visualsPrompt : undefined,
              image_prompts: pagePrompts.length > 0 ? pagePrompts : undefined,
              model: "claude-sonnet-4-6",
              visuals_model: imagesEnabled ? "claude-sonnet-4-6" : undefined,
              image_model: imagesEnabled ? "fal-ai/flux/dev" : "",
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
        const logAttributes = {
          user_id: user.id,
          account_id: userRow.account_id,
          job_id: job.id,
          profile_count: profiles.length,
          story_length: storyLength,
          include_images: includeImages,
          images_enabled: imagesEnabled,
          image_count: imagesEnabled ? lengthConfig.imageCount : 0,
          provider: "anthropic",
        }

        Sentry.logger.error("Story generation stream failed", logAttributes)
        Sentry.captureException(err, {
          tags: {
            area: "story_generation",
            provider: "anthropic",
          },
          extra: logAttributes,
        })
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

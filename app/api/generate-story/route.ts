import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { generateStoryStream, extractStoryTitle, splitStoryPages } from "@/lib/ai/story"
import { extractVisualContext } from "@/lib/ai/prompt-builder/visual-context"
import { applyArtStyleToReference } from "@/lib/ai/image"
import { getImageProvider } from "@/lib/ai/providers/image/registry"
import type { ImageResult } from "@/lib/ai/providers/image/types"
import { joinNames, buildCharacterAnchor, buildCharacterAnchorSlim, formatAge } from "@/lib/ai/prompt-builder"
import { buildStoryPagePrompt } from "@/lib/ai/image-prompt"
import { checkStoryRateLimit } from "@/lib/rate-limit"
import { config } from "@/lib/config"
import {
  buildStoryImagePath,
  copyRemoteImageToStoragePath,
  createSignedImageUrlsMap,
} from "@/lib/storage/images"
import type { KidProfile, StoryTemplate, StoryImage } from "@/types"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"
import { TEXT_DENSITIES, DEFAULT_TEXT_DENSITY, type TextDensityKey } from "@/lib/story-density"

const STORY_IMAGE_ERROR_PATH = "/images/story-image-error.svg"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const profileIds    = body?.profileIds    as string[] | undefined
  const artStyleId    = body?.artStyleId    as string   | undefined
  const rawLength        = body?.storyLength       as string   | undefined
  const storyLength: StoryLength = (rawLength && rawLength in STORY_LENGTHS) ? rawLength as StoryLength : "short"
  const rawDensity       = body?.textDensity       as string   | undefined
  const textDensity: TextDensityKey = (rawDensity && rawDensity in TEXT_DENSITIES) ? rawDensity as TextDensityKey : DEFAULT_TEXT_DENSITY
  const storyTypeId      = body?.storyTypeId      as string   | undefined
  const storyTypeExtraInput = body?.storyTypeExtraInput as string | undefined
  const storyDescription = body?.storyDescription as string   | undefined
  const customTitle      = body?.customTitle      as string   | undefined
  const includeImages    = body?.includeImages    as boolean  ?? false
  const parentStoryId    = body?.parentStoryId    as string   | undefined
  const feedback         = body?.feedback         as string   | undefined
  const imageProviderId  = (body?.imageProvider   as string   | undefined) ?? "fal"

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
  const imageProviderKeyAvailable =
    imageProviderId === "openai" ? !!process.env.OPENAI_API_KEY :
    imageProviderId === "gemini" ? !!process.env.GEMINI_API_KEY :
    !!process.env.FAL_KEY
  const imagesEnabled = includeImages && imageProviderKeyAvailable
  const baseCredits = await config.creditsPerStory()
  const creditsNeeded = baseCredits + (imagesEnabled ? lengthConfig.imageCost : 0)

  if (!account || account.credit_balance < creditsNeeded) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
  }

  type StoryTypeRow = {
    id: string
    name: string
    system_prompt_suffix: string
    structure_template: string
    page_guidance: { first: string; middle: string; last: string }
    extra_input_label: string | null
  }

  // Fetch profiles, template, parent story, default art style, and story type in parallel
  const [profilesResult, { data: template }, parentResult, { data: artStyle }, storyTypeResult] = await Promise.all([
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
    storyTypeId
      ? service
          .from("story_types")
          .select("id, name, system_prompt_suffix, structure_template, page_guidance, extra_input_label")
          .eq("id", storyTypeId)
          .eq("is_active", true)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const profiles = profilesResult.data as KidProfile[] | null
  if (!profiles?.length) return NextResponse.json({ error: "Profiles not found" }, { status: 404 })
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  if (parentStoryId && !parentResult.data) {
    return NextResponse.json({ error: "Parent story not found" }, { status: 404 })
  }

  if (!storyTypeId) {
    return NextResponse.json({ error: "A story type is required." }, { status: 400 })
  }
  if (!storyTypeResult.data) {
    return NextResponse.json({ error: "Story type not found" }, { status: 404 })
  }
  const storyType = storyTypeResult.data as StoryTypeRow

  const profilesMissingIllustrations = profiles.filter(
    p => !p.combined_reference_path && !p.character_illustration_path && !p.reference_image_path
  )
  if (profilesMissingIllustrations.length > 0) {
    const missingNames = profilesMissingIllustrations.map(p => p.name).join(", ")
    return NextResponse.json(
      { error: `Character illustrations are not ready for: ${missingNames}. Please visit their profile to generate an illustration before creating a story.` },
      { status: 400 }
    )
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
  const systemPrompt = storyType
    ? `${t.system_prompt}\n\n${storyType.system_prompt_suffix}`
    : t.system_prompt

  // Age-calibrated language guidance based on the youngest child in the story
  const youngestAge = Math.min(...profiles.map(p => p.age + (p.age_months ?? 0) / 12))
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
    attrs.push(formatAge(p.age, p.age_months ?? 0))
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
    userPrompt += `\n\nStory request: ${storyDescription.trim()}`
  }

  const pg = storyType.page_guidance
  userPrompt += `\n\n---\n\nNarrative arc:\n${storyType.structure_template}`
  userPrompt += `\n\nPage guidance:\n- Opening pages: ${pg.first}\n- Middle pages: ${pg.middle}\n- Final pages: ${pg.last}`
  if (storyTypeExtraInput?.trim()) {
    const label = storyType.extra_input_label ?? "Additional context"
    userPrompt += `\n\n${label}: ${storyTypeExtraInput.trim()}`
  }

  userPrompt += `\n\n---\n\nBegin your response with "Title: [your story title]" on its own line, then write the story.

Write exactly ${lengthConfig.pages} pages. Separate each page with a line containing only "--- Page N ---" (e.g. "--- Page 1 ---", "--- Page 2 ---"). ${TEXT_DENSITIES[textDensity].promptInstruction}

${ageGuidance}

Each page must describe one clear visual moment — where the characters are, what they are doing, and what is physically around them. Keep dialogue brief and grounded in a scene; avoid pages that are only internal thoughts or abstract feelings with no visual action.${personalityDirective}`

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
        // TEMP: remove before shipping
        console.log("=== SYSTEM PROMPT ===\n", systemPrompt)
        console.log("=== USER PROMPT ===\n", userPrompt)
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

        const images: StoryImage[] = []
        let characterAnchor = ""
        let pagePrompts: string[] = []

        if (imagesEnabled) {
          const storyPages = splitStoryPages(fullText)
          const signedReferenceUrlsByPath = await createSignedImageUrlsMap(
            service,
            profiles
              .map((profile) => profile.reference_image_path)
              .filter((path): path is string => Boolean(path))
          )
          const profilesForReference = profiles.map((profile) => ({
            ...profile,
            reference_image_url: profile.reference_image_path
              ? signedReferenceUrlsByPath.get(profile.reference_image_path) ?? profile.reference_image_url
              : profile.reference_image_url,
          }))

          const referenceProfileIds = new Set(
            profilesForReference.filter((profile) => Boolean(profile.reference_image_url)).map((profile) => profile.id)
          )
          // Strip trailing comma/whitespace from prompt_prefix so it doesn't create
          // double-comma artifacts when composed into the full image prompt.
          const styleDescription = artStyle?.prompt_prefix
            ? artStyle.prompt_prefix.replace(/[,\s]+$/, "")
            : "children's picture book illustration"

          send({ type: "status", message: "Reading story for illustrations…" })
          const characterNames = profiles.map(p => p.name)
          const toyNames = profiles
            .map(p => p.toy?.name)
            .filter((name): name is string => Boolean(name) && name !== "their favorite toy")
          const visualContext = await extractVisualContext(storyPages, characterNames, toyNames, styleDescription)

          characterAnchor = buildCharacterAnchor(profilesForReference, {})

          send({ type: "status", message: "Applying art style…" })
          const baseReferenceUrl = profilesForReference.find((p) => p.reference_image_url)?.reference_image_url ?? null
          const referenceImageUrl = (baseReferenceUrl && artStyle?.prompt_prefix)
            ? await applyArtStyleToReference(baseReferenceUrl, styleDescription)
            : baseReferenceUrl

          // Fixed seed for the fallback FLUX/dev path so character features stay consistent
          // across pages when no Kontext reference image is available
          const storySeed = Math.floor(Math.random() * 2147483647)

          send({ type: "status", message: `Generating ${lengthConfig.imageCount} images…` })
          pagePrompts = Array.from({ length: lengthConfig.imageCount }, (_, i) => {
            const pageScene = visualContext.pageScenes[i]
              ?? visualContext.pageScenes[visualContext.pageScenes.length - 1]
              ?? { pageIndex: i, text: "", action: "", characters: [], toys: [], setting: "", mood: "warm" }
            const anchor = referenceImageUrl
              ? buildCharacterAnchorSlim(profilesForReference, {}, referenceProfileIds)
              : characterAnchor
            return buildStoryPagePrompt({
              scene: pageScene,
              visualContext,
              artStylePrefix: styleDescription,
              referenceAvailable: !!referenceImageUrl,
              characterDescriptions: anchor,
            })
          })

          // Brief pause before the first image so the fal.ai rate limit window
          // can settle after any setup calls (style transfer, etc.)
          await new Promise(r => setTimeout(r, 5000))

          // Sequential generation avoids rate limits that cause concurrent requests
          // to exhaust retries and silently return null.
          const imageProvider = getImageProvider(imageProviderId)
          const generatedResults: ImageResult[] = []
          for (let imgIdx = 0; imgIdx < pagePrompts.length; imgIdx++) {
            const result = await imageProvider.generateImage(pagePrompts[imgIdx], {
              referenceImageUrl,
              seed: storySeed,
            })
            generatedResults.push(result)
            if (result.url === null) {
              Sentry.logger.warn("Image generation returned null", {
                provider: imageProviderId,
                scene_index: imgIdx,
                user_id: user.id,
                job_id: job.id,
                attempts: result.attempts,
              })
            } else if (result.isBlackImage) {
              Sentry.logger.warn("Image generation returned black image", {
                provider: imageProviderId,
                scene_index: imgIdx,
                user_id: user.id,
                job_id: job.id,
                attempts: result.attempts,
                flagged_url: result.url,
              })
            }
          }
          for (const [sceneIndex, result] of generatedResults.entries()) {
            if (result.url === null || result.isBlackImage) {
              Sentry.logger.warn("Image generation using error placeholder", {
                provider: imageProviderId,
                scene_index: sceneIndex,
                job_id: job.id,
                reason: result.url === null ? "null_url" : "black_image",
              })
              images.push({ url: STORY_IMAGE_ERROR_PATH, caption: null, scene_index: sceneIndex })
              continue
            }

            const storedPath = await copyRemoteImageToStoragePath({
              supabase: service,
              sourceUrl: result.url,
              buildPath: (extension) => buildStoryImagePath(userRow.account_id, job.id, sceneIndex, extension),
            })

            if (storedPath) {
              images.push({ path: storedPath, caption: null, scene_index: sceneIndex })
            } else {
              // Keep legacy URL fallback only when storage upload fails.
              images.push({ url: result.url, caption: null, scene_index: sceneIndex })
            }
          }
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
              story_type_id: storyType?.id ?? undefined,
              text_density: textDensity,
              prompt_summary: profiles.map(p => p.prompt_summary).join(" "),
              system_prompt: systemPrompt,
              user_prompt: userPrompt,
              image_prompt: characterAnchor,
              character_anchor: characterAnchor || undefined,
              image_prompts: pagePrompts.length > 0 ? pagePrompts : undefined,
              model: "claude-sonnet-4-6",
              image_provider: imagesEnabled ? imageProviderId : undefined,
              image_model: imagesEnabled ? (
                imageProviderId === "openai" ? "gpt-image-1" :
                imageProviderId === "gemini" ? "imagen-3.0-generate-001" :
                "fal-ai/flux/dev"
              ) : "",
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

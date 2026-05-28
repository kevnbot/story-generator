import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { formatAge } from "@/lib/ai/prompt-builder"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"
import { TEXT_DENSITIES, DEFAULT_TEXT_DENSITY, type TextDensityKey } from "@/lib/story-density"
import type { KidProfile, StoryTemplate } from "@/types"

type StoryTypeRow = {
  id: string
  name: string
  system_prompt_suffix: string
  structure_template: string
  page_guidance: { first: string; middle: string; last: string }
  extra_input_label: string | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const profileIds    = body?.profileIds    as string[] | undefined
  const storyTypeId   = body?.storyTypeId   as string   | undefined
  const rawLength     = body?.storyLength   as string   | undefined
  const rawDensity    = body?.textDensity   as string   | undefined
  const storyDescription = body?.storyDescription as string | undefined
  const extraInput    = body?.extraInput    as string   | undefined

  const storyLength: StoryLength = (rawLength && rawLength in STORY_LENGTHS) ? rawLength as StoryLength : "medium"
  const textDensity: TextDensityKey = (rawDensity && rawDensity in TEXT_DENSITIES) ? rawDensity as TextDensityKey : DEFAULT_TEXT_DENSITY

  if (!profileIds?.length) return NextResponse.json({ error: "profileIds required" }, { status: 400 })
  if (!storyTypeId) return NextResponse.json({ error: "storyTypeId required" }, { status: 400 })

  const service = createServiceClient()

  const [profilesResult, { data: rawTemplate }, storyTypeResult] = await Promise.all([
    service
      .from("kid_profiles")
      .select("*")
      .in("id", profileIds)
      .is("deleted_at", null),
    service
      .from("story_templates")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single(),
    service
      .from("story_types")
      .select("id, name, system_prompt_suffix, structure_template, page_guidance, extra_input_label")
      .eq("id", storyTypeId)
      .eq("is_active", true)
      .single(),
  ])

  const profiles = profilesResult.data as KidProfile[] | null
  if (!profiles?.length) return NextResponse.json({ error: "Profiles not found" }, { status: 404 })
  if (!rawTemplate) return NextResponse.json({ error: "No active story template" }, { status: 404 })
  if (!storyTypeResult.data) return NextResponse.json({ error: "Story type not found" }, { status: 404 })

  const t = rawTemplate as StoryTemplate
  const storyType = storyTypeResult.data as StoryTypeRow

  // ── Prompt construction — mirrors app/api/generate-story/route.ts ─────────

  const systemPrompt = `${t.system_prompt}\n\n${storyType.system_prompt_suffix}`

  const youngestAge = Math.min(...profiles.map(p => p.age + (p.age_months ?? 0) / 12))
  const ageGuidance = youngestAge <= 4
    ? "Use very simple words and short sentences a toddler can follow. Sensory details, gentle repetition, and playful sounds work well. Each page should feel like it can be read in one breath."
    : youngestAge <= 7
    ? "Use simple, clear language with short sentences. Stick to concrete actions and feelings. Avoid complex vocabulary or abstract ideas."
    : "You can use richer vocabulary and longer sentences. Include some emotional depth and a satisfying narrative arc."

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

  const lengthConfig = STORY_LENGTHS[storyLength]
  const pg = storyType.page_guidance

  let userPrompt = `${characterLabel}:\n${characterLines}`

  if (storyDescription?.trim()) {
    userPrompt += `\n\nStory request: ${storyDescription.trim()}`
  }

  userPrompt += `\n\n---\n\nNarrative arc:\n${storyType.structure_template}`
  userPrompt += `\n\nPage guidance:\n- Opening pages: ${pg.first}\n- Middle pages: ${pg.middle}\n- Final pages: ${pg.last}`

  if (extraInput?.trim()) {
    const label = storyType.extra_input_label ?? "Additional context"
    userPrompt += `\n\n${label}: ${extraInput.trim()}`
  }

  userPrompt += `\n\n---\n\nBegin your response with "Title: [your story title]" on its own line, then write the story.

Write exactly ${lengthConfig.pages} pages. Separate each page with a line containing only "--- Page N ---" (e.g. "--- Page 1 ---", "--- Page 2 ---"). ${TEXT_DENSITIES[textDensity].promptInstruction}

${ageGuidance}

Each page must describe one clear visual moment — where the characters are, what they are doing, and what is physically around them. Keep dialogue brief and grounded in a scene; avoid pages that are only internal thoughts or abstract feelings with no visual action.${personalityDirective}`

  // ── Token estimates ────────────────────────────────────────────────────────

  const systemTokens = Math.ceil(systemPrompt.length / 4)
  const userTokens = Math.ceil(userPrompt.length / 4)
  const combined = systemTokens + userTokens
  const contextWindowPercent = Math.round(combined / 200000 * 100 * 10) / 10

  return NextResponse.json({
    systemPrompt,
    userPrompt,
    storyTypeContribution: {
      systemPromptSuffix: storyType.system_prompt_suffix,
      structureTemplate: storyType.structure_template,
      pageGuidance: storyType.page_guidance,
    },
    tokenCounts: {
      system: systemTokens,
      user: userTokens,
      combined,
      contextWindowPercent,
    },
    meta: {
      profileCount: profiles.length,
      storyTypeId: storyType.id,
      storyTypeName: storyType.name,
      storyLength,
      textDensity,
      pageCount: lengthConfig.pages,
    },
  })
}

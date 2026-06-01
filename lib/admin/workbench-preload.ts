import { DEFAULT_IMAGE_PROVIDER_ID } from "@/lib/ai/providers/image/options"
import { DEFAULT_TEXT_DENSITY, TEXT_DENSITIES, type TextDensityKey } from "@/lib/story-density"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"

export interface WorkbenchProfile {
  id: string
  account_id?: string
  name: string
  age: number
  age_months: number
  gender?: string | null
  appearance?: {
    hair?: string
    hair_color?: string
    hair_style?: string
    eye_color?: string
    skin_tone?: string
    glasses?: boolean
    freckles?: boolean
    other?: string
  } | null
  personality_tags?: string[] | null
  toy?: {
    name: string
    type?: string
    color?: string
    description?: string
  } | null
  reference_image_path: string | null
  reference_image_url?: string | null
  combined_reference_path: string | null
  combined_reference_url?: string | null
  character_illustration_path: string | null
  character_illustration_url?: string | null
  illustration_status?: string | null
  deleted_at?: string | null
  is_source_only?: boolean
}

export interface WorkbenchStoryType {
  id: string
  name: string
  description: string
  occasion_required?: boolean | null
  extra_input_label: string | null
  extra_input_hint: string | null
  system_prompt_suffix?: string | null
  structure_template?: string | null
  page_guidance?: { first: string; middle: string; last: string } | null
}

export interface WorkbenchArtStyle {
  id: string
  name: string
}

export interface WorkbenchResolvedStoryImage {
  url: string
  caption: string | null
  scene_index: number
}

export interface WorkbenchPromptSeed {
  systemPrompt: string
  userPrompt: string
  storyTypeContribution: {
    systemPromptSuffix: string
    structureTemplate: string
    pageGuidance: { first: string; middle: string; last: string }
  }
  tokenCounts: {
    system: number
    user: number
    combined: number
    contextWindowPercent: number
  }
  meta: {
    profileCount: number
    storyTypeId: string
    storyTypeName: string
    storyLength: string
    textDensity: string
    pageCount: number
  }
}

export interface WorkbenchTextSeed {
  fullText: string
  durationMs: number
  model: string
}

export interface WorkbenchGeneratedImageSeed {
  pageIndex: number
  url: string | null
  isErrorPlaceholder: boolean
  provider: string
  model: string
  referenceUsed: boolean
  attempts: number
  attemptsLog: {
    attempt: number
    resultUrl: string | null
    isBlackImage: boolean
    contentLengthBytes: number | null
    rejectionReason: string | null
    backoffMs: number | null
  }[]
  isBlackImage: boolean
  contentLengthBytes: number | null
  rawResponseStatus: number | null
  error: string | null
  durationMs: number
}

export interface WorkbenchSourceContext {
  storyId: string
  storyTitle: string
  storyCreatedAt: string
  accountId: string
  accountName: string | null
  userId: string
  userEmail: string | null
  userDisplayName: string | null
  missingFields: string[]
  archivedProfileNames: string[]
}

export interface WorkbenchInitialStory {
  sourceContext: WorkbenchSourceContext
  selectedProfileIds: string[]
  storyTypeId: string
  storyLength: StoryLength
  textDensity: TextDensityKey
  storyDescription: string
  extraInput: string
  artStyleId: string
  textProvider: string
  imageProvider: string
  includeImages: boolean
  promptsResult: WorkbenchPromptSeed | null
  textResult: WorkbenchTextSeed | null
  storyPages: string[]
  storyTitle: string
  imagePrompts: string[] | null
  generatedImages: WorkbenchGeneratedImageSeed[] | null
  saveDisabledReason: string
}

export interface WorkbenchInitialStoryInput {
  story: {
    id: string
    title: string
    content: string
    created_at: string
    account_id: string
    user_id: string
    kid_profile_id: string | null
    parent_story_id: string | null
    has_images: boolean
    generation_params: Record<string, unknown> | null
  }
  sourceContext: Omit<WorkbenchSourceContext, "missingFields" | "archivedProfileNames">
  storyTypes: WorkbenchStoryType[]
  artStyles: WorkbenchArtStyle[]
  sourceProfileIds: string[]
  archivedProfileNames: string[]
  resolvedImages: WorkbenchResolvedStoryImage[]
}

const PAGE_BREAK_RE = /^[-–—*\s]*(?:\*{0,2})\s*Page\s+\d+\s*(?:\*{0,2})[-–—*\s]*$/im
const CONTEXT_WINDOW_TOKENS = 200000
const IMPORTED_SAVE_DISABLED_REASON =
  "Imported prompt logs are read-only in workbench. Rerun stages as needed, but saving is disabled to avoid writing to another user's account or charging credits."

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function stripLeadingTitleLine(content: string): string {
  return content.replace(/^Title:\s*.+?(?:\r?\n)+/i, "").trim()
}

export function splitWorkbenchStoryPages(content: string): string[] {
  const lines = content.split("\n")
  const sections: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (PAGE_BREAK_RE.test(line)) {
      const section = current.join("\n").trim()
      if (section) sections.push(section)
      current = []
    } else {
      current.push(line)
    }
  }

  const last = current.join("\n").trim()
  if (last) sections.push(last)

  if (sections.length > 1) return sections
  return content.split(/\n\n+/).map((part) => part.trim()).filter(Boolean)
}

export function getWorkbenchSourceProfileIds(
  generationParams: Record<string, unknown> | null | undefined,
  fallbackProfileId: string | null | undefined
): string[] {
  const params = generationParams ?? {}
  const ids = asStringArray(params.kid_profile_ids)
  const primaryId = asString(params.kid_profile_id) ?? fallbackProfileId ?? undefined
  const combined = primaryId ? [primaryId, ...ids] : ids
  return [...new Set(combined)]
}

export function inferWorkbenchStoryLength(
  rawLength: unknown,
  pageCount: number,
  missingFields: string[]
): StoryLength {
  if (typeof rawLength === "string" && rawLength in STORY_LENGTHS) {
    return rawLength as StoryLength
  }

  const inferred = (Object.keys(STORY_LENGTHS) as StoryLength[]).find(
    (key) => STORY_LENGTHS[key].pages === pageCount
  )
  if (inferred) {
    missingFields.push("Story length was not stored; inferred from page count.")
    return inferred
  }

  missingFields.push("Story length was not stored; defaulted to Medium.")
  return "medium"
}

function resolveTextDensity(rawDensity: unknown, missingFields: string[]): TextDensityKey {
  if (typeof rawDensity === "string" && rawDensity in TEXT_DENSITIES) {
    return rawDensity as TextDensityKey
  }

  missingFields.push("Text density was not stored; defaulted to Read Together.")
  return DEFAULT_TEXT_DENSITY
}

function resolveStoryTypeId(
  rawStoryTypeId: unknown,
  storyTypes: WorkbenchStoryType[],
  missingFields: string[]
): { storyTypeId: string; storyType: WorkbenchStoryType | null } {
  const storedId = asString(rawStoryTypeId)
  const storedType = storedId ? storyTypes.find((type) => type.id === storedId) ?? null : null

  if (storedType) return { storyTypeId: storedType.id, storyType: storedType }

  const fallback = storyTypes[0] ?? null
  if (!storedId) {
    missingFields.push("Story type was not stored; defaulted to the first active story type.")
  } else {
    missingFields.push("Stored story type is no longer active; defaulted to the first active story type for reruns.")
  }

  return { storyTypeId: fallback?.id ?? "", storyType: fallback }
}

function resolveArtStyleId(
  rawArtStyleId: unknown,
  artStyles: WorkbenchArtStyle[],
  missingFields: string[]
): string {
  const storedId = asString(rawArtStyleId)
  if (storedId && artStyles.some((style) => style.id === storedId)) return storedId

  const fallbackId = artStyles[0]?.id ?? ""
  if (!storedId) {
    missingFields.push("Art style was not stored; defaulted to the first active art style.")
  } else {
    missingFields.push("Stored art style is no longer active; defaulted to the first active art style.")
  }
  return fallbackId
}

function inferTextProvider(model: string | undefined): string {
  if (!model) return "anthropic"
  return /gpt|openai/i.test(model) ? "openai" : "anthropic"
}

function buildPromptSeed({
  params,
  storyType,
  storyTypeId,
  storyLength,
  textDensity,
  pageCount,
  profileCount,
}: {
  params: Record<string, unknown>
  storyType: WorkbenchStoryType | null
  storyTypeId: string
  storyLength: StoryLength
  textDensity: TextDensityKey
  pageCount: number
  profileCount: number
}): WorkbenchPromptSeed | null {
  const systemPrompt = asString(params.system_prompt)
  const userPrompt = asString(params.user_prompt)
  if (!systemPrompt || !userPrompt) return null

  const systemTokens = Math.ceil(systemPrompt.length / 4)
  const userTokens = Math.ceil(userPrompt.length / 4)
  const combined = systemTokens + userTokens

  return {
    systemPrompt,
    userPrompt,
    storyTypeContribution: {
      systemPromptSuffix: storyType?.system_prompt_suffix ?? "",
      structureTemplate: storyType?.structure_template ?? "",
      pageGuidance: storyType?.page_guidance ?? { first: "", middle: "", last: "" },
    },
    tokenCounts: {
      system: systemTokens,
      user: userTokens,
      combined,
      contextWindowPercent: Math.round((combined / CONTEXT_WINDOW_TOKENS) * 100 * 10) / 10,
    },
    meta: {
      profileCount,
      storyTypeId,
      storyTypeName: storyType?.name ?? "Unknown",
      storyLength,
      textDensity,
      pageCount,
    },
  }
}

function buildGeneratedImageSeeds(
  images: WorkbenchResolvedStoryImage[],
  params: Record<string, unknown>
): WorkbenchGeneratedImageSeed[] | null {
  if (images.length === 0) return null

  const provider = asString(params.image_provider) ?? DEFAULT_IMAGE_PROVIDER_ID
  const model = asString(params.image_model) ?? ""

  return [...images]
    .sort((a, b) => a.scene_index - b.scene_index)
    .map((image) => ({
      pageIndex: image.scene_index,
      url: image.url,
      isErrorPlaceholder: image.url === "/images/story-image-error.svg",
      provider,
      model,
      referenceUsed: Boolean(params.character_anchor),
      attempts: 1,
      attemptsLog: [],
      isBlackImage: false,
      contentLengthBytes: null,
      rawResponseStatus: null,
      error: null,
      durationMs: 0,
    }))
}

export function buildWorkbenchInitialStory(input: WorkbenchInitialStoryInput): WorkbenchInitialStory {
  const params = input.story.generation_params ?? {}
  const missingFields: string[] = []
  const cleanContent = stripLeadingTitleLine(input.story.content)
  const storyPages = splitWorkbenchStoryPages(cleanContent)
  const { storyTypeId, storyType } = resolveStoryTypeId(params.story_type_id, input.storyTypes, missingFields)
  const storyLength = inferWorkbenchStoryLength(params.story_length, storyPages.length, missingFields)
  const textDensity = resolveTextDensity(params.text_density, missingFields)
  const artStyleId = resolveArtStyleId(params.art_style_id, input.artStyles, missingFields)
  const imagePrompts = asStringArray(params.image_prompts)
  const model = asString(params.model) ?? "stored story"
  const includeImages = asBoolean(params.include_images) ?? (input.story.has_images || imagePrompts.length > 0)
  if (typeof params.include_images !== "boolean") {
    missingFields.push("Image inclusion was not stored; inferred from story images and image prompts.")
  }

  if (!asString(params.story_description)) {
    missingFields.push("Story description was not stored for this log.")
  }
  if (!asString(params.story_type_extra_input)) {
    missingFields.push("Story type extra input was not stored for this log.")
  }

  return {
    sourceContext: {
      ...input.sourceContext,
      missingFields,
      archivedProfileNames: input.archivedProfileNames,
    },
    selectedProfileIds: input.sourceProfileIds,
    storyTypeId,
    storyLength,
    textDensity,
    storyDescription: asString(params.story_description) ?? "",
    extraInput: asString(params.story_type_extra_input) ?? "",
    artStyleId,
    textProvider: inferTextProvider(model),
    imageProvider: asString(params.image_provider) ?? DEFAULT_IMAGE_PROVIDER_ID,
    includeImages,
    promptsResult: buildPromptSeed({
      params,
      storyType,
      storyTypeId,
      storyLength,
      textDensity,
      pageCount: storyPages.length,
      profileCount: input.sourceProfileIds.length,
    }),
    textResult: cleanContent ? { fullText: cleanContent, durationMs: 0, model } : null,
    storyPages,
    storyTitle: input.story.title,
    imagePrompts: imagePrompts.length > 0 ? imagePrompts : null,
    generatedImages: buildGeneratedImageSeeds(input.resolvedImages, params),
    saveDisabledReason: IMPORTED_SAVE_DISABLED_REASON,
  }
}

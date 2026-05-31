import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { buildStoryPagePrompt } from "@/lib/ai/image-prompt"
import { buildKlingReferencePrompt } from "@/lib/ai/providers/image/fal"
import { getImageProviderMetadata } from "@/lib/ai/providers/image/options"
import type { StoryVisualContext } from "@/lib/ai/prompt-builder/visual-context"

function buildAppearanceDescription(appearance: {
  hair?: string
  hair_color?: string
  hair_style?: string
  eye_color?: string
  skin_tone?: string
  glasses?: boolean
  freckles?: boolean
  other?: string
} | null): string {
  if (!appearance) return ""
  const parts: string[] = []
  if (appearance.hair) parts.push(`${appearance.hair} hair`)
  else if (appearance.hair_color && appearance.hair_style) parts.push(`${appearance.hair_color} ${appearance.hair_style} hair`)
  else if (appearance.hair_color) parts.push(`${appearance.hair_color} hair`)
  if (appearance.eye_color) parts.push(`${appearance.eye_color} eyes`)
  if (appearance.skin_tone) parts.push(`${appearance.skin_tone} skin`)
  if (appearance.glasses) parts.push("wears glasses")
  if (appearance.freckles) parts.push("has freckles")
  if (appearance.other) parts.push(appearance.other)
  return parts.join(", ")
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const visualContext = body?.visualContext as StoryVisualContext | undefined
  const artStyleId = body?.artStyleId as string | undefined
  const profileIds = body?.profileIds as string[] | undefined
  const referenceAvailable = body?.referenceAvailable as boolean | undefined
  const imageProvider = getImageProviderMetadata(body?.imageProvider as string | undefined)
  const referenceImageLabels = body?.referenceImageLabels as string[] | undefined

  if (!visualContext?.pageScenes?.length) return NextResponse.json({ error: "visualContext required" }, { status: 400 })
  if (!profileIds?.length) return NextResponse.json({ error: "profileIds required" }, { status: 400 })

  const service = createServiceClient()

  const [profilesResult, artStyleResult] = await Promise.all([
    service
      .from("kid_profiles")
      .select("id, name, age, gender, appearance, toy")
      .in("id", profileIds)
      .is("deleted_at", null),
    artStyleId
      ? service
          .from("art_styles")
          .select("id, name, prompt_prefix")
          .eq("id", artStyleId)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const profiles = profilesResult.data ?? []
  const artStyle = artStyleResult.data as { id: string; name: string; prompt_prefix: string } | null

  const artStylePrefix = artStyle?.prompt_prefix
    ? artStyle.prompt_prefix.replace(/[,\s]+$/, "")
    : "children's picture book illustration"

  const characterDetails: Record<string, {
    gender: string
    age: number
    appearanceDescription?: string
    outfit?: string
    toyName?: string
    toyDescription?: string
  }> = {}
  for (const p of profiles) {
    const toy = p.toy as { name?: string; description?: string } | null
    const appearanceDescription = buildAppearanceDescription(p.appearance as Parameters<typeof buildAppearanceDescription>[0])
    characterDetails[p.name] = {
      gender: (p.gender as string | null) ?? "child",
      age: p.age as number,
      ...(appearanceDescription ? { appearanceDescription } : {}),
      ...(visualContext.outfits[p.name] ? { outfit: visualContext.outfits[p.name] } : {}),
      ...(toy?.name ? { toyName: toy.name } : {}),
      ...(toy?.description ? { toyDescription: toy.description } : {}),
    }
  }

  const prompts = visualContext.pageScenes.map(scene => {
    const prompt = buildStoryPagePrompt({
      scene,
      visualContext,
      artStylePrefix,
      referenceAvailable: referenceAvailable ?? false,
      characterDetails,
      storyCharacters: visualContext.storyCharacters,
    })
    return imageProvider.id === "fal-kling-o1"
      ? buildKlingReferencePrompt(prompt, referenceImageLabels ?? [])
      : prompt
  })

  return NextResponse.json({ prompts })
}

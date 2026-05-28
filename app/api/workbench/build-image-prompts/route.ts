import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { buildStoryPagePrompt } from "@/lib/ai/image-prompt"
import type { StoryVisualContext } from "@/lib/ai/prompt-builder/visual-context"

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

  if (!visualContext?.pageScenes?.length) return NextResponse.json({ error: "visualContext required" }, { status: 400 })
  if (!profileIds?.length) return NextResponse.json({ error: "profileIds required" }, { status: 400 })

  const service = createServiceClient()

  const [profilesResult, artStyleResult] = await Promise.all([
    service
      .from("kid_profiles")
      .select("id, name, age, gender, toy")
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

  const characterDetails: Record<string, { gender: string; age: number; toyName?: string; toyDescription?: string }> = {}
  for (const p of profiles) {
    const toy = p.toy as { name?: string; description?: string } | null
    characterDetails[p.name] = {
      gender: (p.gender as string | null) ?? "child",
      age: p.age as number,
      ...(toy?.name ? { toyName: toy.name } : {}),
      ...(toy?.description ? { toyDescription: toy.description } : {}),
    }
  }

  const prompts = visualContext.pageScenes.map(scene =>
    buildStoryPagePrompt({
      scene,
      visualContext,
      artStylePrefix,
      referenceAvailable: referenceAvailable ?? false,
      characterDetails,
      storyCharacters: visualContext.storyCharacters,
    })
  )

  return NextResponse.json({ prompts })
}

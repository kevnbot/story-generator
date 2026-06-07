import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { withRouteLogging } from "@/lib/api/with-logging"
import { buildStoryCharacterReferencePrompt } from "@/lib/ai/prompt-builder"
import type { CharacterReference } from "@/lib/ai/providers/image/options"

export const POST = withRouteLogging("workbench/generate-story-character-references", async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const storyCharacters = body?.storyCharacters as Array<{
    name: string
    description: string
    pageAppearances: number[]
  }> | undefined

  if (!storyCharacters?.length) {
    return NextResponse.json({ storyCharacterRefs: [], skipped: [] })
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json({
      storyCharacterRefs: [],
      skipped: storyCharacters.map(sc => ({ name: sc.name, reason: "FAL_KEY not configured" })),
    })
  }

  const sorted = [...storyCharacters].sort((a, b) => b.pageAppearances.length - a.pageAppearances.length)
  const top2 = sorted.slice(0, 2)
  const beyond = sorted.slice(2).map(sc => ({ name: sc.name, reason: "beyond cap of 2" }))

  type GenerationResult =
    | { success: true; ref: CharacterReference }
    | { success: false; name: string; reason: string }

  const results: GenerationResult[] = await Promise.all(
    top2.map(async (character): Promise<GenerationResult> => {
      const prompt = buildStoryCharacterReferencePrompt(character)
      try {
        const response = await fetch("https://fal.run/fal-ai/flux/dev", {
          method: "POST",
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            num_images: 1,
            image_size: "square_hd",
            output_format: "jpeg",
            num_inference_steps: 28,
          }),
        })

        if (!response.ok) {
          return { success: false, name: character.name, reason: `generation failed: HTTP ${response.status}` }
        }

        const data = await response.json() as { images?: { url: string }[] }
        const url = data.images?.[0]?.url
        if (!url) {
          return { success: false, name: character.name, reason: "generation returned no image" }
        }

        return {
          success: true,
          ref: {
            name: character.name,
            imageUrl: url,
            role: "story_character",
            description: character.description,
          },
        }
      } catch {
        return { success: false, name: character.name, reason: "network error" }
      }
    })
  )

  const storyCharacterRefs: CharacterReference[] = []
  const failedSkipped: { name: string; reason: string }[] = []

  for (const result of results) {
    if (result.success) {
      storyCharacterRefs.push(result.ref)
    } else {
      failedSkipped.push({ name: result.name, reason: result.reason })
    }
  }

  return NextResponse.json({
    storyCharacterRefs,
    skipped: [...beyond, ...failedSkipped],
  })
})

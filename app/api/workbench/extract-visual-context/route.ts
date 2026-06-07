import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { withRouteLogging } from "@/lib/api/with-logging"
import { extractVisualContext } from "@/lib/ai/prompt-builder/visual-context"

export const POST = withRouteLogging("workbench/extract-visual-context", async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const storyPages = body?.storyPages as string[] | undefined
  const characterNames = body?.characterNames as string[] | undefined
  const toyNames = (body?.toyNames as string[] | undefined) ?? []
  const artStyleDescription = body?.artStyleDescription as string | undefined

  if (!storyPages?.length) return NextResponse.json({ error: "storyPages required" }, { status: 400 })
  if (!characterNames?.length) return NextResponse.json({ error: "characterNames required" }, { status: 400 })
  if (!artStyleDescription?.trim()) return NextResponse.json({ error: "artStyleDescription required" }, { status: 400 })

  const startMs = Date.now()
  const { result: visualContext, parseSuccess } = await extractVisualContext(
    storyPages,
    characterNames,
    toyNames,
    artStyleDescription
  )
  const durationMs = Date.now() - startMs

  return NextResponse.json({
    visualContext,
    meta: {
      parseSuccess,
      durationMs,
      model: "claude-haiku-4-5-20251001",
      pageCount: storyPages.length,
      storyCharactersFound: visualContext.storyCharacters.length,
    },
  })
})

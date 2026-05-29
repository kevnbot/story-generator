import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { getImageProvider } from "@/lib/ai/providers/image/registry"

interface ImageAttemptLog {
  attempt: number
  resultUrl: string | null
  isBlackImage: boolean
  contentLengthBytes: number | null
  rejectionReason: string | null
  backoffMs: number | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const prompt = body?.prompt as string | undefined
  const referenceImageUrl = body?.referenceImageUrl as string | undefined
  const imageProvider = body?.imageProvider as string | undefined
  const pageIndex = body?.pageIndex as number | undefined

  if (!prompt?.trim()) return NextResponse.json({ error: "prompt required" }, { status: 400 })
  if (pageIndex === undefined) return NextResponse.json({ error: "pageIndex required" }, { status: 400 })

  const provider = getImageProvider(imageProvider)

  const startMs = Date.now()
  const result = await provider.generateImage(prompt, {
    referenceImageUrl: referenceImageUrl ?? undefined,
  })
  const durationMs = Date.now() - startMs

  const isErrorPlaceholder = result.url === null || result.isBlackImage
  const url = isErrorPlaceholder ? "/images/story-image-error.svg" : result.url

  const model =
    imageProvider === "openai" ? "gpt-image-1"
    : imageProvider === "gemini" ? "imagen-3.0-generate-001"
    : referenceImageUrl ? "fal-ai/flux-pro/kontext"
    : "fal-ai/flux/dev"

  const attemptsLog: ImageAttemptLog[] = []

  return NextResponse.json({
    pageIndex,
    url,
    isErrorPlaceholder,
    provider: provider.label,
    model,
    referenceUsed: !!(referenceImageUrl && !isErrorPlaceholder),
    attempts: result.attempts,
    attemptsLog,
    isBlackImage: result.isBlackImage,
    contentLengthBytes: null,
    rawResponseStatus: null,
    error: result.error,
    durationMs,
  })
}

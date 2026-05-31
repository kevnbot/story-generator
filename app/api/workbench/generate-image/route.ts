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
  const referenceImageUrls = body?.referenceImageUrls as string[] | undefined
  const referenceImageLabels = body?.referenceImageLabels as string[] | undefined
  const imageProvider = body?.imageProvider as string | undefined
  const pageIndex = body?.pageIndex as number | undefined

  if (!prompt?.trim()) return NextResponse.json({ error: "prompt required" }, { status: 400 })
  if (pageIndex === undefined) return NextResponse.json({ error: "pageIndex required" }, { status: 400 })

  const provider = getImageProvider(imageProvider)
  const resolvedReferenceUrls = [
    ...(referenceImageUrls ?? []),
    ...(referenceImageUrl ? [referenceImageUrl] : []),
  ].filter((url, index, urls) => url.trim() && urls.indexOf(url) === index)

  if (provider.supportsReferenceImages && resolvedReferenceUrls.length === 0) {
    return NextResponse.json({ error: "referenceImageUrls required for selected image provider" }, { status: 400 })
  }
  if (provider.maxReferenceImages !== null && resolvedReferenceUrls.length > provider.maxReferenceImages) {
    return NextResponse.json(
      { error: `${provider.label} supports at most ${provider.maxReferenceImages} reference images.` },
      { status: 400 }
    )
  }

  const startMs = Date.now()
  const result = await provider.generateImage(prompt, {
    referenceImageUrl: referenceImageUrl ?? undefined,
    referenceImageUrls: referenceImageUrls ?? undefined,
    referenceImageLabels: referenceImageLabels ?? undefined,
  })
  const durationMs = Date.now() - startMs

  const isErrorPlaceholder = result.url === null || result.isBlackImage
  const url = isErrorPlaceholder ? "/images/story-image-error.svg" : result.url

  const model = result.modelId ?? provider.modelId

  const attemptsLog: ImageAttemptLog[] = []

  return NextResponse.json({
    pageIndex,
    url,
    isErrorPlaceholder,
    provider: provider.label,
    model,
    referenceUsed: !!(provider.supportsReferenceImages && result.referenceImageCount && !isErrorPlaceholder),
    attempts: result.attempts,
    attemptsLog,
    isBlackImage: result.isBlackImage,
    contentLengthBytes: null,
    rawResponseStatus: null,
    error: result.error,
    durationMs,
  })
}

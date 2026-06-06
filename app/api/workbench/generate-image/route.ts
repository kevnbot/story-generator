import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { getImageProvider } from "@/lib/ai/providers/image/registry"
import { resolveCharacterReferences } from "@/lib/ai/providers/image/fal"
import type { ImageResult } from "@/lib/ai/providers/image/types"
import type { CharacterReference } from "@/lib/ai/providers/image/options"

interface ImageAttemptLog {
  attempt: number
  resultUrl: string | null
  isBlackImage: boolean
  contentLengthBytes: number | null
  rejectionReason: string | null
  backoffMs: number | null
}

function sanitizeProviderError(error: string | null): string | null {
  if (!error) return null

  let message = error
  try {
    const parsed = JSON.parse(error) as {
      error?: { message?: string; code?: string; type?: string; status?: string }
      message?: string
    }
    const providerMessage = parsed.error?.message ?? parsed.message
    if (providerMessage) {
      const prefix = [parsed.error?.status, parsed.error?.code, parsed.error?.type]
        .filter(Boolean)
        .join(" ")
      message = prefix ? `${prefix}: ${providerMessage}` : providerMessage
    }
  } catch {
    // Provider responses are not always JSON.
  }

  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(/[A-Za-z0-9_-]{32,}:[A-Za-z0-9_-]{32,}/g, "[redacted]")
    .slice(0, 1000)
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
  const characterReferences = body?.characterReferences as CharacterReference[] | undefined
  const imageProvider = body?.imageProvider as string | undefined
  const pageIndex = body?.pageIndex as number | undefined

  if (!prompt?.trim()) return NextResponse.json({ error: "prompt required" }, { status: 400 })
  if (pageIndex === undefined) return NextResponse.json({ error: "pageIndex required" }, { status: 400 })

  const provider = getImageProvider(imageProvider)

  let finalReferenceUrls = [
    ...(referenceImageUrls ?? []),
    ...(referenceImageUrl ? [referenceImageUrl] : []),
  ].filter((url, index, urls) => url.trim() && urls.indexOf(url) === index)
  let finalReferenceLabels = referenceImageLabels

  if (characterReferences?.length) {
    const resolved = resolveCharacterReferences(characterReferences)
    finalReferenceUrls = resolved.urls
    finalReferenceLabels = resolved.labels
  }

  if (provider.supportsReferenceImages && finalReferenceUrls.length === 0) {
    return NextResponse.json({ error: "referenceImageUrls required for selected image provider" }, { status: 400 })
  }
  if (provider.maxReferenceImages !== null && finalReferenceUrls.length > provider.maxReferenceImages) {
    return NextResponse.json(
      { error: `${provider.label} supports at most ${provider.maxReferenceImages} reference images.` },
      { status: 400 }
    )
  }

  const startMs = Date.now()
  let result: ImageResult
  try {
    result = await provider.generateImage(prompt, {
      referenceImageUrl: finalReferenceUrls[0] ?? undefined,
      referenceImageUrls: finalReferenceUrls.length > 0 ? finalReferenceUrls : undefined,
      referenceImageLabels: finalReferenceLabels ?? undefined,
      characterReferences: characterReferences ?? undefined,
    })
  } catch (error) {
    const durationMs = Date.now() - startMs
    return NextResponse.json({
      pageIndex,
      url: "/images/story-image-error.svg",
      isErrorPlaceholder: true,
      provider: provider.label,
      model: provider.modelId,
      referenceUsed: false,
      attempts: 0,
      attemptsLog: [],
      isBlackImage: false,
      contentLengthBytes: null,
      rawResponseStatus: null,
      error: sanitizeProviderError(error instanceof Error ? error.message : String(error)),
      durationMs,
    })
  }
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
    rawResponseStatus: result.statusCode ?? null,
    error: sanitizeProviderError(result.error),
    durationMs,
  })
}

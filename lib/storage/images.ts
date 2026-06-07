import type { SupabaseClient } from "@supabase/supabase-js"
import type { KidProfile, StoryImage, StoryImageForUi } from "@/types"
import { readImageUrl } from "@/lib/image-data"
import { logger, logError } from "@/lib/logger"

export const GENERATED_IMAGES_BUCKET = process.env.SUPABASE_IMAGES_BUCKET ?? "generated-images"

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 20
function parseSignedUrlTtl(): number {
  const raw = process.env.SUPABASE_IMAGE_SIGNED_URL_TTL_SECONDS
  if (!raw) return DEFAULT_SIGNED_URL_TTL_SECONDS
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_SIGNED_URL_TTL_SECONDS
  return parsed
}

export const IMAGE_SIGNED_URL_TTL_SECONDS = parseSignedUrlTtl()

async function fetchRemoteImage(sourceUrl: string): Promise<{ bytes: ArrayBuffer; contentType: string; extension: string }> {
  return readImageUrl(sourceUrl)
}

export function buildProfileReferenceImagePath(
  accountId: string,
  profileId: string,
  extension = "webp",
  timestamp = Date.now()
): string {
  return `accounts/${accountId}/profiles/${profileId}/reference/${timestamp}.${extension}`
}

export function buildStoryImagePath(
  accountId: string,
  storyOrJobId: string,
  sceneIndex: number,
  extension = "webp",
  timestamp = Date.now()
): string {
  return `accounts/${accountId}/stories/${storyOrJobId}/${timestamp}-scene-${sceneIndex + 1}.${extension}`
}

export interface CopyRemoteImageInput {
  supabase: SupabaseClient
  sourceUrl: string
  destinationPath: string
  bucket?: string
  cacheControl?: string
}

export async function copyRemoteImageToStorage({
  supabase,
  sourceUrl,
  destinationPath,
  bucket = GENERATED_IMAGES_BUCKET,
  cacheControl = "31536000",
}: CopyRemoteImageInput): Promise<{ path: string; contentType: string } | null> {
  try {
    const remote = await fetchRemoteImage(sourceUrl)
    const { error } = await supabase
      .storage
      .from(bucket)
      .upload(destinationPath, remote.bytes, {
        upsert: true,
        cacheControl,
        contentType: remote.contentType,
      })

    if (error) {
      logger.error("supabase storage upload failed", {
        bucket,
        path: destinationPath,
        status_code: Number.parseInt(error.statusCode ?? "0", 10) || 0,
      })
      return null
    }

    return { path: destinationPath, contentType: remote.contentType }
  } catch (error) {
    logError("image storage copy failed", error, {
      area: "image_storage_copy",
      bucket,
      path: destinationPath,
    })
    return null
  }
}

export async function copyRemoteImageToStoragePath(
  input: Omit<CopyRemoteImageInput, "destinationPath"> & {
    buildPath: (extension: string) => string
  }
): Promise<string | null> {
  try {
    const remote = await fetchRemoteImage(input.sourceUrl)
    const destinationPath = input.buildPath(remote.extension)

    const { error } = await input.supabase
      .storage
      .from(input.bucket ?? GENERATED_IMAGES_BUCKET)
      .upload(destinationPath, remote.bytes, {
        upsert: true,
        cacheControl: input.cacheControl ?? "31536000",
        contentType: remote.contentType,
      })

    if (error) {
      logger.error("supabase storage upload failed", {
        bucket: input.bucket ?? GENERATED_IMAGES_BUCKET,
        path: destinationPath,
        status_code: Number.parseInt(error.statusCode ?? "0", 10) || 0,
      })
      return null
    }

    return destinationPath
  } catch (error) {
    logError("image storage copy failed", error, {
      area: "image_storage_copy",
      bucket: input.bucket ?? GENERATED_IMAGES_BUCKET,
    })
    return null
  }
}

export async function createSignedImageUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = IMAGE_SIGNED_URL_TTL_SECONDS,
  bucket = GENERATED_IMAGES_BUCKET
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) {
    logger.error("supabase signed image url failed", {
      bucket,
      path,
      status_code: Number.parseInt(error.statusCode ?? "0", 10) || 0,
    })
    return null
  }
  return data?.signedUrl ?? null
}

export async function createSignedImageUrlsMap(
  supabase: SupabaseClient,
  paths: string[],
  expiresIn = IMAGE_SIGNED_URL_TTL_SECONDS,
  bucket = GENERATED_IMAGES_BUCKET
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  if (uniquePaths.length === 0) return new Map()

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(uniquePaths, expiresIn)
  if (error) {
    logger.error("supabase signed image urls batch failed", {
      bucket,
      path_count: uniquePaths.length,
      status_code: Number.parseInt(error.statusCode ?? "0", 10) || 0,
    })
    return new Map()
  }

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) {
      map.set(row.path, row.signedUrl)
    }
  }
  return map
}

export function hasStoredReferenceImage(profile: Pick<KidProfile, "reference_image_path" | "reference_image_url">): boolean {
  return Boolean(profile.reference_image_path || profile.reference_image_url)
}

export function resolveStoryImagesForUi(images: StoryImage[], signedUrlMap: Map<string, string>): StoryImageForUi[] {
  const resolved: StoryImageForUi[] = []

  for (const image of images) {
    const url = image.path ? signedUrlMap.get(image.path) ?? image.url ?? null : image.url ?? null
    if (!url) continue

    resolved.push({
      ...image,
      url,
    })
  }

  return resolved
}

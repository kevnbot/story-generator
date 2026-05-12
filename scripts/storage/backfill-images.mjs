import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.SUPABASE_IMAGES_BUCKET ?? "generated-images"
const DRY_RUN = process.env.DRY_RUN === "true"
const PROFILE_BATCH_SIZE = Number.parseInt(process.env.PROFILE_BACKFILL_BATCH_SIZE ?? "100", 10)
const STORY_BATCH_SIZE = Number.parseInt(process.env.STORY_BACKFILL_BATCH_SIZE ?? "100", 10)

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

function normalizeContentType(contentType) {
  if (!contentType) return "image/webp"
  return contentType.split(";")[0].trim().toLowerCase()
}

function extensionFromContentType(contentType) {
  return MIME_EXTENSION_MAP[contentType] ?? "webp"
}

async function fetchRemoteImage(sourceUrl) {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`failed to fetch image: status ${response.status}`)
  }

  const contentType = normalizeContentType(response.headers.get("content-type"))
  if (!contentType.startsWith("image/")) {
    throw new Error(`invalid content type: ${contentType}`)
  }

  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error("empty image response")
  }

  return {
    bytes,
    contentType,
    extension: extensionFromContentType(contentType),
  }
}

async function backfillProfileReferenceImages() {
  const { data: profiles, error } = await supabase
    .from("kid_profiles")
    .select("id, account_id, reference_image_path, reference_image_url")
    .is("reference_image_path", null)
    .not("reference_image_url", "is", null)
    .limit(PROFILE_BATCH_SIZE)

  if (error) throw new Error(`profile query failed: ${error.message}`)

  let migrated = 0
  for (const profile of profiles ?? []) {
    try {
      const sourceUrl = profile.reference_image_url
      if (!sourceUrl) continue
      const remote = await fetchRemoteImage(sourceUrl)
      const path = `accounts/${profile.account_id}/profiles/${profile.id}/reference/${Date.now()}.${remote.extension}`

      if (!DRY_RUN) {
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, remote.bytes, {
          upsert: true,
          cacheControl: "31536000",
          contentType: remote.contentType,
        })
        if (uploadError) throw new Error(`upload failed: ${uploadError.message}`)

        const { error: updateError } = await supabase
          .from("kid_profiles")
          .update({ reference_image_path: path })
          .eq("id", profile.id)

        if (updateError) throw new Error(`profile update failed: ${updateError.message}`)
      }

      migrated += 1
    } catch (err) {
      console.error("profile backfill failed", {
        profile_id: profile.id,
        account_id: profile.account_id,
        bucket: BUCKET,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { scanned: profiles?.length ?? 0, migrated }
}

async function backfillStoryImages() {
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, account_id, images")
    .eq("has_images", true)
    .limit(STORY_BATCH_SIZE)

  if (error) throw new Error(`story query failed: ${error.message}`)

  let migratedStories = 0
  let migratedImages = 0

  for (const story of stories ?? []) {
    try {
      const sourceImages = Array.isArray(story.images) ? story.images : []
      let changed = false

      const migratedStoryImages = []
      for (const image of sourceImages) {
        const existingPath = typeof image?.path === "string" ? image.path : null
        const existingUrl = typeof image?.url === "string" ? image.url : null

        if (existingPath || !existingUrl) {
          migratedStoryImages.push(image)
          continue
        }

        const remote = await fetchRemoteImage(existingUrl)
        const path = `accounts/${story.account_id}/stories/${story.id}/${Date.now()}-scene-${Number(image?.scene_index ?? 0) + 1}.${remote.extension}`

        if (!DRY_RUN) {
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, remote.bytes, {
            upsert: true,
            cacheControl: "31536000",
            contentType: remote.contentType,
          })
          if (uploadError) throw new Error(`upload failed: ${uploadError.message}`)
        }

        migratedStoryImages.push({
          ...image,
          path,
        })
        changed = true
        migratedImages += 1
      }

      if (changed && !DRY_RUN) {
        const { error: updateError } = await supabase
          .from("stories")
          .update({ images: migratedStoryImages })
          .eq("id", story.id)

        if (updateError) throw new Error(`story update failed: ${updateError.message}`)
      }

      if (changed) migratedStories += 1
    } catch (err) {
      console.error("story image backfill failed", {
        story_id: story.id,
        account_id: story.account_id,
        bucket: BUCKET,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    scanned: stories?.length ?? 0,
    migrated_stories: migratedStories,
    migrated_images: migratedImages,
  }
}

async function main() {
  console.log("Starting image backfill", {
    bucket: BUCKET,
    dry_run: DRY_RUN,
    profile_batch_size: PROFILE_BATCH_SIZE,
    story_batch_size: STORY_BATCH_SIZE,
  })

  const profileResult = await backfillProfileReferenceImages()
  const storyResult = await backfillStoryImages()

  console.log("Backfill complete", {
    profile_result: profileResult,
    story_result: storyResult,
  })
}

main().catch((error) => {
  console.error("Backfill failed", error)
  process.exit(1)
})

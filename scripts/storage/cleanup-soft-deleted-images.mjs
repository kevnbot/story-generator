import * as Sentry from "@sentry/nextjs"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.SUPABASE_IMAGES_BUCKET ?? "generated-images"
const DRY_RUN = process.env.DRY_RUN === "true"
const RETENTION_DAYS = Number.parseInt(process.env.IMAGE_CLEANUP_RETENTION_DAYS ?? "30", 10)
const BATCH_SIZE = Number.parseInt(process.env.IMAGE_CLEANUP_BATCH_SIZE ?? "200", 10)

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

const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

async function removePaths(paths) {
  if (paths.length === 0 || DRY_RUN) return

  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) {
    throw new Error(`storage remove failed: ${error.message}`)
  }
}

async function cleanupProfiles() {
  const { data: profiles, error } = await supabase
    .from("kid_profiles")
    .select("id, account_id, reference_image_path")
    .not("reference_image_path", "is", null)
    .not("deleted_at", "is", null)
    .lte("deleted_at", cutoff)
    .limit(BATCH_SIZE)

  if (error) throw new Error(`profile cleanup query failed: ${error.message}`)

  let cleaned = 0

  for (const profile of profiles ?? []) {
    try {
      if (!profile.reference_image_path) continue
      await removePaths([profile.reference_image_path])

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from("kid_profiles")
          .update({ reference_image_path: null, reference_image_url: null })
          .eq("id", profile.id)

        if (updateError) throw new Error(`profile update failed: ${updateError.message}`)
      }

      cleaned += 1
    } catch (error) {
      Sentry.logger.error("profile image cleanup failed", {
        account_id: profile.account_id,
        profile_id: profile.id,
        bucket: BUCKET,
        path: profile.reference_image_path,
      })
      Sentry.captureException(error, {
        tags: { area: "image_cleanup", target: "profile" },
        extra: {
          account_id: profile.account_id,
          profile_id: profile.id,
          bucket: BUCKET,
          path: profile.reference_image_path,
        },
      })
    }
  }

  return {
    scanned: profiles?.length ?? 0,
    cleaned,
  }
}

async function cleanupStories() {
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, account_id, images")
    .not("deleted_at", "is", null)
    .lte("deleted_at", cutoff)
    .eq("has_images", true)
    .limit(BATCH_SIZE)

  if (error) throw new Error(`story cleanup query failed: ${error.message}`)

  let cleanedStories = 0
  let removedImages = 0

  for (const story of stories ?? []) {
    try {
      const images = Array.isArray(story.images) ? story.images : []
      const paths = images
        .map((image) => (typeof image?.path === "string" ? image.path : null))
        .filter((path) => Boolean(path))

      await removePaths(paths)

      if (!DRY_RUN) {
        const strippedImages = images.map((image) => {
          if (typeof image?.path !== "string") return image
          const next = { ...image }
          delete next.path
          return next
        })

        const { error: updateError } = await supabase
          .from("stories")
          .update({ images: strippedImages })
          .eq("id", story.id)

        if (updateError) throw new Error(`story update failed: ${updateError.message}`)
      }

      if (paths.length > 0) {
        cleanedStories += 1
        removedImages += paths.length
      }
    } catch (error) {
      Sentry.logger.error("story image cleanup failed", {
        account_id: story.account_id,
        story_id: story.id,
        bucket: BUCKET,
      })
      Sentry.captureException(error, {
        tags: { area: "image_cleanup", target: "story" },
        extra: {
          account_id: story.account_id,
          story_id: story.id,
          bucket: BUCKET,
        },
      })
    }
  }

  return {
    scanned: stories?.length ?? 0,
    cleaned_stories: cleanedStories,
    removed_images: removedImages,
  }
}

async function main() {
  console.log("Starting image cleanup", {
    bucket: BUCKET,
    retention_days: RETENTION_DAYS,
    cutoff,
    dry_run: DRY_RUN,
    batch_size: BATCH_SIZE,
  })

  const [profileResult, storyResult] = await Promise.all([
    cleanupProfiles(),
    cleanupStories(),
  ])

  console.log("Cleanup complete", {
    profile_result: profileResult,
    story_result: storyResult,
  })
}

main().catch((error) => {
  console.error("Cleanup failed", error)
  process.exit(1)
})

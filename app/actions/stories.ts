"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"

export async function deleteStory(storyId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const service = createServiceClient()
    const { data: userRow } = await service
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (!userRow) return { error: "User not found" }

    const { error } = await service
      .from("stories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", storyId)
      .eq("account_id", userRow.account_id)

    if (error) return { error: error.message }

    revalidatePath("/stories")
    return {}
  } catch (error) {
    logError("deleteStory failed", error, { action: "deleteStory" })
    throw error
  }
}

// Publish a story so anyone with its share link can read it. Returns the share token.
// Reuses an existing token on re-publish so previously shared links keep working.
export async function publishStory(
  storyId: string
): Promise<{ token?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const service = createServiceClient()
    const { data: userRow } = await service
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (!userRow) return { error: "User not found" }

    // Read any existing token (scoped to the owner's account).
    const { data: existing } = await service
      .from("stories")
      .select("share_token")
      .eq("id", storyId)
      .eq("account_id", userRow.account_id)
      .single()

    if (!existing) return { error: "Story not found" }

    const token = existing.share_token ?? crypto.randomUUID()

    const { error } = await service
      .from("stories")
      .update({
        is_published: true,
        share_token: token,
        published_at: new Date().toISOString(),
      })
      .eq("id", storyId)
      .eq("account_id", userRow.account_id)

    if (error) return { error: error.message }

    return { token }
  } catch (error) {
    logError("publishStory failed", error, { action: "publishStory" })
    throw error
  }
}

// Stop sharing a story. The share token is kept so re-publishing reuses the same link.
export async function unpublishStory(
  storyId: string
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const service = createServiceClient()
    const { data: userRow } = await service
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (!userRow) return { error: "User not found" }

    const { error } = await service
      .from("stories")
      .update({ is_published: false })
      .eq("id", storyId)
      .eq("account_id", userRow.account_id)

    if (error) return { error: error.message }

    return {}
  } catch (error) {
    logError("unpublishStory failed", error, { action: "unpublishStory" })
    throw error
  }
}

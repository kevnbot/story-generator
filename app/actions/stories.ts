"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function deleteStory(storyId: string): Promise<{ error?: string }> {
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
}

import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { withRouteLogging } from "@/lib/api/with-logging"
import { buildToyIllustrationPrompt } from "@/lib/ai/prompt-builder"
import type { KidToy } from "@/types"

export const POST = withRouteLogging("workbench/toy-prompt-preview", async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const { profileId } = (body ?? {}) as { profileId?: string }

  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 })

  const service = createServiceClient()
  const { data: profileRow } = await service
    .from("kid_profiles")
    .select("toy")
    .eq("id", profileId)
    .is("deleted_at", null)
    .single()

  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const toy = profileRow.toy as KidToy | null
  if (!toy?.name) return NextResponse.json({ prompt: null })

  const prompt = buildToyIllustrationPrompt(toy)
  return NextResponse.json({ prompt })
})

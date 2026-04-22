import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { generateStoryStream, extractStoryTitle } from "@/lib/ai/story"
import { fillPromptTemplate } from "@/lib/ai/prompt-builder"
import { checkStoryRateLimit } from "@/lib/rate-limit"
import { config } from "@/lib/config"
import type { KidProfile, StoryTemplate } from "@/types"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const profileId = body?.profileId as string | undefined
  const templateId = body?.templateId as string | undefined

  if (!profileId || !templateId) {
    return NextResponse.json({ error: "profileId and templateId required" }, { status: 400 })
  }

  const { allowed } = await checkStoryRateLimit(user.id)
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { data: account } = await service
    .from("accounts")
    .select("credit_balance")
    .eq("id", userRow.account_id)
    .single()

  const creditsNeeded = await config.creditsPerStory()

  if (!account || account.credit_balance < creditsNeeded) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
  }

  const [{ data: profile }, { data: template }] = await Promise.all([
    service
      .from("kid_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("account_id", userRow.account_id)
      .is("deleted_at", null)
      .single(),
    service
      .from("story_templates")
      .select("*")
      .eq("id", templateId)
      .eq("is_active", true)
      .single(),
  ])

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  const userPrompt = fillPromptTemplate(
    (template as StoryTemplate).user_prompt_template,
    profile as KidProfile
  )
  const systemPrompt = (template as StoryTemplate).system_prompt

  const { data: job } = await service
    .from("generation_jobs")
    .insert({
      account_id: userRow.account_id,
      user_id: user.id,
      kid_profile_id: profileId,
      story_template_id: templateId,
      status: "generating",
      credits_held: creditsNeeded,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!job) return NextResponse.json({ error: "Failed to start generation" }, { status: 500 })

  const encoder = new TextEncoder()
  let fullText = ""

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))

      try {
        for await (const chunk of generateStoryStream(systemPrompt, userPrompt)) {
          fullText += chunk
          send({ type: "chunk", text: chunk })
        }

        const title = await extractStoryTitle(fullText, (profile as KidProfile).name)

        const { data: story } = await service
          .from("stories")
          .insert({
            account_id: userRow.account_id,
            user_id: user.id,
            kid_profile_id: profileId,
            story_template_id: templateId,
            job_id: job.id,
            title,
            content: fullText,
            images: [],
            generation_params: {
              kid_profile_id: profileId,
              story_template_id: templateId,
              prompt_summary: (profile as KidProfile).prompt_summary,
              system_prompt: systemPrompt,
              user_prompt: userPrompt,
              image_prompt: (template as StoryTemplate).image_prompt_template,
              model: "claude-opus-4-7",
              image_model: "",
            },
            credits_used: creditsNeeded,
          })
          .select()
          .single()

        await Promise.all([
          service
            .from("accounts")
            .update({ credit_balance: account.credit_balance - creditsNeeded })
            .eq("id", userRow.account_id),
          service.from("credit_transactions").insert({
            account_id: userRow.account_id,
            user_id: user.id,
            amount: -creditsNeeded,
            type: "spend",
            description: `Story: ${title}`,
          }),
          service
            .from("generation_jobs")
            .update({ status: "complete", completed_at: new Date().toISOString() })
            .eq("id", job.id),
        ])

        send({ type: "done", storyId: story?.id ?? null, title })
        controller.close()
      } catch (err) {
        await service
          .from("generation_jobs")
          .update({ status: "failed", error_message: String(err) })
          .eq("id", job.id)
        send({ type: "error", message: "Story generation failed. Please try again." })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

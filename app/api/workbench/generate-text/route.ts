import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { generateStoryStream } from "@/lib/ai/story"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const systemPrompt = body?.systemPrompt as string | undefined
  const userPrompt = body?.userPrompt as string | undefined

  if (!systemPrompt?.trim()) return NextResponse.json({ error: "systemPrompt required" }, { status: 400 })
  if (!userPrompt?.trim()) return NextResponse.json({ error: "userPrompt required" }, { status: 400 })

  const encoder = new TextEncoder()
  const startMs = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generateStoryStream(systemPrompt, userPrompt)) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "chunk", text: chunk }) + "\n"))
        }
        const durationMs = Date.now() - startMs
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done", durationMs, model: "claude-sonnet-4-6" }) + "\n"))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed"
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message }) + "\n"))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  })
}

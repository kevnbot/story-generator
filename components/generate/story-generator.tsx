"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

interface Profile {
  id: string
  name: string
  age: number
}

interface Template {
  id: string
  name: string
  description: string
  credits_cost: number
}

interface StoryGeneratorProps {
  profiles: Profile[]
  templates: Template[]
  credits: number
}

type StreamChunk =
  | { type: "chunk"; text: string }
  | { type: "done"; storyId: string | null; title: string }
  | { type: "error"; message: string }

export function StoryGenerator({ profiles, templates, credits }: StoryGeneratorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    profiles[0] ? new Set([profiles[0].id]) : new Set()
  )
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle")
  const [storyText, setStoryText] = useState("")
  const [storyTitle, setStoryTitle] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const storyRef = useRef<HTMLDivElement>(null)

  const selectedTemplate = templates.find(t => t.id === templateId)
  const creditsNeeded = selectedTemplate?.credits_cost ?? 10
  const canGenerate = selectedIds.size > 0 && templateId && credits >= creditsNeeded && status !== "generating"

  function toggleProfile(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        // don't deselect the last one
        if (next.size === 1) return prev
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function generate() {
    setStatus("generating")
    setStoryText("")
    setStoryTitle("")
    setErrorMsg("")

    try {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: [...selectedIds], templateId }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setErrorMsg(data.error ?? "Generation failed")
        setStatus("error")
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line) as StreamChunk
            if (chunk.type === "chunk") {
              setStoryText(prev => {
                const next = prev + chunk.text
                requestAnimationFrame(() =>
                  storyRef.current?.scrollTo({ top: storyRef.current.scrollHeight, behavior: "smooth" })
                )
                return next
              })
            } else if (chunk.type === "done") {
              setStoryTitle(chunk.title ?? "Your Story")
              setStatus("done")
            } else if (chunk.type === "error") {
              setErrorMsg(chunk.message)
              setStatus("error")
            }
          } catch {}
        }
      }
    } catch {
      setErrorMsg("Connection error. Please try again.")
      setStatus("error")
    }
  }

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
        <div className="text-5xl">👧</div>
        <h2 className="text-xl font-semibold">Add a kid profile first</h2>
        <p className="text-muted-foreground max-w-sm">
          Profiles let us personalize the story with your child's name, age, and favorite things.
        </p>
        <Button asChild>
          <a href="/profiles">Add Profile</a>
        </Button>
      </div>
    )
  }

  const selectionLabel = selectedIds.size === 0
    ? "Select at least one"
    : selectedIds.size === 1
      ? profiles.find(p => selectedIds.has(p.id))?.name
      : `${selectedIds.size} kids`

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Generate a Story</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {credits} credit{credits !== 1 ? "s" : ""} remaining
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Who stars in this story?</label>
            {profiles.length > 1 && (
              <span className="text-xs text-muted-foreground">{selectionLabel} selected</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {profiles.map(p => {
              const isSelected = selectedIds.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProfile(p.id)}
                  className={`p-3 rounded-lg border text-left transition-colors relative ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {profiles.length > 1 && (
                    <span
                      className={`absolute top-2 right-2 w-4 h-4 rounded-sm border flex items-center justify-center text-[10px] font-bold transition-colors ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  )}
                  <div className="font-medium text-sm pr-5">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Age {p.age}</div>
                </button>
              )
            })}
          </div>
          {profiles.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Select multiple kids to have them all appear in the story together.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Story style</label>
          <div className="grid gap-2">
            {templates.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  templateId === t.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.credits_cost} credit{t.credits_cost !== 1 ? "s" : ""}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {credits < creditsNeeded && (
          <p className="text-sm text-destructive">
            Not enough credits. This story costs {creditsNeeded} credits and you have {credits}.
          </p>
        )}

        <Button
          onClick={generate}
          disabled={!canGenerate}
          className="w-full"
          size="lg"
        >
          {status === "generating" ? "Writing your story..." : "Generate Story"}
        </Button>
      </div>

      {(storyText || status === "generating") && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          {storyTitle && <h2 className="text-xl font-bold">{storyTitle}</h2>}
          {status === "generating" && !storyTitle && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span className="animate-pulse">✨</span>
              Writing your story...
            </div>
          )}
          <div
            ref={storyRef}
            className="prose prose-sm max-w-none leading-relaxed whitespace-pre-wrap text-foreground max-h-[60vh] overflow-y-auto"
          >
            {storyText}
            {status === "generating" && (
              <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            )}
          </div>
          {status === "done" && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus("idle")
                  setStoryText("")
                  setStoryTitle("")
                }}
              >
                Generate another
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/stories">View all stories</a>
              </Button>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMsg}
          <button
            type="button"
            onClick={() => { setStatus("idle"); setErrorMsg("") }}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

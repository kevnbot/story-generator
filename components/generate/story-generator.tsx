"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAge } from "@/lib/ai/prompt-builder"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"

interface Profile {
  id: string
  name: string
  age: number
  age_months: number
}

interface Template {
  id: string
  name: string
  description: string
  credits_cost: number
}

interface ArtStyle {
  id: string
  name: string
}

interface StoryGeneratorProps {
  profiles: Profile[]
  templates: Template[]
  artStyles: ArtStyle[]
  credits: number
  imagesAvailable: boolean
  parentStoryId?: string
  parentStoryTitle?: string
  defaultProfileIds?: string[]
  defaultTemplateId?: string
}

type StreamChunk =
  | { type: "chunk"; text: string }
  | { type: "status"; message: string }
  | { type: "done"; storyId: string | null; title: string; hasImages: boolean }
  | { type: "error"; message: string }

export function StoryGenerator({
  profiles,
  templates,
  artStyles,
  credits,
  imagesAvailable,
  parentStoryId,
  parentStoryTitle,
  defaultProfileIds = [],
  defaultTemplateId = "",
}: StoryGeneratorProps) {
  const initialIds = defaultProfileIds.length > 0
    ? new Set(defaultProfileIds)
    : profiles[0] ? new Set([profiles[0].id]) : new Set<string>()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialIds)
  const [templateId, setTemplateId] = useState(defaultTemplateId || templates[0]?.id || "")
  const [artStyleId, setArtStyleId] = useState(artStyles[0]?.id ?? "")
  const [storyLength, setStoryLength] = useState<StoryLength>("short")
  const [storyDescription, setStoryDescription] = useState("")
  const [customTitle, setCustomTitle] = useState("")
  const [includeImages, setIncludeImages] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [storyText, setStoryText] = useState("")
  const [storyTitle, setStoryTitle] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const storyRef = useRef<HTMLDivElement>(null)

  const selectedTemplate = templates.find(t => t.id === templateId)
  const lengthConfig = STORY_LENGTHS[storyLength]
  const baseCost = selectedTemplate?.credits_cost ?? 1
  const imageCost = includeImages && imagesAvailable ? lengthConfig.imageCost : 0
  const creditsNeeded = baseCost + imageCost
  const canGenerate = selectedIds.size > 0 && templateId && credits >= creditsNeeded && status !== "generating"

  function toggleProfile(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
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
    setStatusMessage("Writing your story...")
    setStoryText("")
    setStoryTitle("")
    setErrorMsg("")

    try {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileIds: [...selectedIds],
          templateId,
          artStyleId: artStyleId || undefined,
          storyLength,
          storyDescription: storyDescription.trim() || undefined,
          customTitle: customTitle.trim() || undefined,
          includeImages,
          parentStoryId: parentStoryId || undefined,
          feedback: feedback.trim() || undefined,
        }),
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
            } else if (chunk.type === "status") {
              setStatusMessage(chunk.message)
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
        <h1 className="text-2xl font-bold">
          {parentStoryId ? "New Version" : "Generate a Story"}
        </h1>
        {parentStoryId && parentStoryTitle ? (
          <p className="text-muted-foreground text-sm mt-1">
            Creating a new version of &ldquo;{parentStoryTitle}&rdquo;
          </p>
        ) : (
          <p className="text-muted-foreground text-sm mt-1">
            {credits} credit{credits !== 1 ? "s" : ""} remaining
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-5">

        {/* Profile selector */}
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
                  <div className="text-xs text-muted-foreground">{formatAge(p.age, p.age_months ?? 0)}</div>
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

        {/* Template selector */}
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
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Story length */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Story length</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(STORY_LENGTHS) as [StoryLength, typeof STORY_LENGTHS[StoryLength]][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStoryLength(key)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  storyLength === key
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                <div className="font-medium text-sm">{cfg.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cfg.pages} pages · {cfg.imageCount} images
                </div>
                <div className="text-xs text-muted-foreground">
                  +{cfg.imageCost} image credit{cfg.imageCost !== 1 ? "s" : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Art style */}
        {artStyles.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Art style</label>
            <div className="flex flex-wrap gap-2">
              {artStyles.map(style => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setArtStyleId(style.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    artStyleId === style.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary font-medium"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Story description */}
        <div className="space-y-1.5">
          <Label htmlFor="story-description">What should the story be about?</Label>
          <textarea
            id="story-description"
            rows={3}
            placeholder="e.g. going to the dentist for the first time, a dragon who is afraid of the dark, finding a secret door in the garden…"
            value={storyDescription}
            onChange={e => setStoryDescription(e.target.value)}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="custom-title">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="custom-title"
            placeholder="Leave blank to auto-generate"
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
          />
        </div>

        {/* Feedback — only shown when creating a version */}
        {parentStoryId && (
          <div className="space-y-1.5">
            <Label htmlFor="feedback">Changes or feedback <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <textarea
              id="feedback"
              rows={3}
              placeholder="Leave blank to generate a fresh version, or describe what you'd like changed..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
        )}

        {/* Images toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-medium">Include images</div>
            <div className="text-xs text-muted-foreground">
              {imagesAvailable
                ? `+${lengthConfig.imageCost} credit${lengthConfig.imageCost !== 1 ? "s" : ""} — ${lengthConfig.imageCount} AI-generated illustrations`
                : "Image generation is not configured"}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={includeImages}
            onClick={() => imagesAvailable && setIncludeImages(v => !v)}
            disabled={!imagesAvailable}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              includeImages ? "bg-primary" : "bg-input"
            } ${!imagesAvailable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                includeImages ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Cost + generate */}
        <div className="space-y-3 pt-1 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cost</span>
            <span className="font-medium">{creditsNeeded} credit{creditsNeeded !== 1 ? "s" : ""}</span>
          </div>
          {credits < creditsNeeded && (
            <p className="text-sm text-destructive">
              Not enough credits. You have {credits}.
            </p>
          )}
          <Button
            onClick={generate}
            disabled={!canGenerate}
            className="w-full"
            size="lg"
          >
            {status === "generating"
              ? statusMessage || "Writing your story..."
              : parentStoryId ? "Generate New Version" : "Generate Story"}
          </Button>
        </div>
      </div>

      {/* Story output */}
      {(storyText || status === "generating") && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          {storyTitle && <h2 className="text-xl font-bold">{storyTitle}</h2>}
          {status === "generating" && !storyTitle && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span className="animate-pulse">✨</span>
              {statusMessage || "Writing your story..."}
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
                  setStoryLength("short")
                  setStoryDescription("")
                  setFeedback("")
                  setCustomTitle("")
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

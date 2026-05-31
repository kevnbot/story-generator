"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAge } from "@/lib/ai/prompt-builder"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"
import { TEXT_DENSITIES, DEFAULT_TEXT_DENSITY, type TextDensity, type TextDensityKey } from "@/lib/story-density"
import { FEATURES } from "@/lib/config/features"

interface Profile {
  id: string
  name: string
  age: number
  age_months: number
  reference_image_path?: string | null
  combined_reference_path?: string | null
  character_illustration_path?: string | null
}

function hasIllustration(p: Profile): boolean {
  return !!(p.combined_reference_path || p.character_illustration_path || p.reference_image_path)
}

interface ArtStyle {
  id: string
  name: string
}

interface StoryType {
  id: string
  name: string
  description: string
  extra_input_label: string | null
  extra_input_hint: string | null
}

interface StoryGeneratorProps {
  profiles: Profile[]
  artStyles: ArtStyle[]
  storyTypes: StoryType[]
  credits: number
  imagesAvailable: boolean
  parentStoryId?: string
  parentStoryTitle?: string
  defaultProfileIds?: string[]
}

type StreamChunk =
  | { type: "chunk"; text: string }
  | { type: "status"; message: string }
  | { type: "done"; storyId: string | null; title: string; hasImages: boolean }
  | { type: "error"; message: string }

const STORY_TYPE_EMOJI: Record<string, string> = {
  bedtime: "🌙",
  fairytale: "✨",
  adventure: "🗺️",
  silly: "😄",
  mystery: "🔍",
  special_event: "🎉",
  educational: "📚",
  custom: "🎨",
}

export function StoryGenerator({
  profiles,
  artStyles,
  storyTypes = [],
  credits,
  imagesAvailable,
  parentStoryId,
  parentStoryTitle,
  defaultProfileIds = [],
}: StoryGeneratorProps) {
  const eligibleProfileIds = profiles.filter(hasIllustration).map(p => p.id)
  const initialIds = defaultProfileIds.length > 0
    ? new Set(FEATURES.multiProfile ? defaultProfileIds : defaultProfileIds.slice(0, 1))
    : new Set(FEATURES.multiProfile ? eligibleProfileIds : eligibleProfileIds.slice(0, 1))

  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialIds)
  const [storyTypeId, setStoryTypeId] = useState(storyTypes[0]?.id ?? "")
  const [storyTypeExtraInput, setStoryTypeExtraInput] = useState("")
  const [artStyleId, setArtStyleId] = useState(artStyles[0]?.id ?? "")
  const [storyLength, setStoryLength] = useState<StoryLength>("short")
  const [textDensity, setTextDensity] = useState<TextDensityKey>(DEFAULT_TEXT_DENSITY)
  const [storyDescription, setStoryDescription] = useState("")
  const [customTitle, setCustomTitle] = useState("")
  const [includeImages, setIncludeImages] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [storyTitle, setStoryTitle] = useState("")
  const [storyId, setStoryId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const lengthConfig = STORY_LENGTHS[storyLength]
  const imageCost = includeImages && imagesAvailable ? lengthConfig.imageCost : 0
  const creditsNeeded = 1 + imageCost
  const canGenerate = selectedIds.size > 0 && !!storyTypeId && credits >= creditsNeeded && status !== "generating"

  const isIllustrating = statusMessage.toLowerCase().startsWith("generating") ||
    statusMessage.toLowerCase().startsWith("illustrating")

  function toggleProfile(id: string) {
    const profile = profiles.find(p => p.id === id)
    if (!profile || !hasIllustration(profile)) return
    if (!FEATURES.multiProfile) {
      setSelectedIds(new Set([id]))
      return
    }
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

  const selectedStoryType = storyTypes.find(t => t.id === storyTypeId) ?? null

  function reset() {
    setStatus("idle")
    setStatusMessage("")
    setStoryTitle("")
    setStoryId(null)
    setErrorMsg("")
    setStoryLength("short")
    setTextDensity(DEFAULT_TEXT_DENSITY)
    setStoryDescription("")
    setFeedback("")
    setCustomTitle("")
    setStoryTypeId(storyTypes[0]?.id ?? "")
    setStoryTypeExtraInput("")
  }

  async function generate() {
    setStatus("generating")
    setStatusMessage("")
    setStoryTitle("")
    setStoryId(null)
    setErrorMsg("")

    try {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileIds: [...selectedIds],
          artStyleId: artStyleId || undefined,
          storyLength,
          storyTypeId: storyTypeId || undefined,
          textDensity,
          storyTypeExtraInput: storyTypeExtraInput.trim() || undefined,
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
            if (chunk.type === "status") {
              setStatusMessage(chunk.message)
            } else if (chunk.type === "done") {
              setStoryTitle(chunk.title ?? "Your Story")
              setStoryId(chunk.storyId)
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
          Profiles let us personalize the story with your child&apos;s name, age, and favorite things.
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
    <div style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "8px" }}>

      {/* Page header */}
      <div className="mb-6">
        <p className="text-sm" style={{ color: "#a78bfa" }}>
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"} ✦
        </p>
        <h1 className="text-xl font-semibold mt-0.5" style={{ color: "#2e1065" }}>
          What&apos;s your wish tonight?
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#a78bfa" }}>
          Your genie is ready to make magic
        </p>
      </div>

      {/* Loading state */}
      {status === "generating" && (
        <div className="rounded-xl border bg-card p-10 flex flex-col items-center text-center gap-8">
          <div className="flex gap-3 text-4xl">
            <span className="animate-bounce [animation-delay:0ms]">
              {isIllustrating ? "🎨" : "✏️"}
            </span>
            <span className="animate-bounce [animation-delay:150ms]">
              {isIllustrating ? "🖼️" : "📖"}
            </span>
            <span className="animate-bounce [animation-delay:300ms]">
              {isIllustrating ? "✨" : "⭐"}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              {isIllustrating ? "Creating the illustrations…" : "Writing your story…"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isIllustrating
                ? "Our AI artist is painting each page — almost there!"
                : "Our storyteller is crafting a unique adventure for your little one."}
            </p>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Done state */}
      {status === "done" && (
        <div className="rounded-xl border bg-card p-10 flex flex-col items-center text-center gap-6">
          <div className="text-5xl">🎉</div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold">{storyTitle || "Your story is ready!"}</h2>
            <p className="text-sm text-muted-foreground">
              Saved to your library — read it any time.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            {storyId && (
              <Button size="lg" asChild>
                <a href={`/library/${storyId}`}>Read Story</a>
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={reset}>
              Generate Another
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
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

      {/* Form — hidden while generating or done */}
      {status === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Revision mode banner */}
          {parentStoryTitle && (
            <div style={{ backgroundColor: "#f5f0ff", border: "1.5px solid #e9d5ff", borderRadius: "12px", padding: "12px 14px" }}>
              <p className="text-sm font-medium" style={{ color: "#6d28d9" }}>Revising: {parentStoryTitle}</p>
              <p className="text-xs mt-0.5" style={{ color: "#a78bfa" }}>Your genie will craft a new version with your changes.</p>
            </div>
          )}

          {/* Character selector */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.6px", textTransform: "uppercase", color: "#c4b5fd", margin: 0 }}>
                {FEATURES.multiProfile ? "Characters" : "Character"}
              </p>
              {profiles.length > 1 && (
                <span className="text-xs text-muted-foreground">{selectionLabel}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {profiles.map(p => {
                const isSelected = selectedIds.has(p.id)
                const isDisabled = !hasIllustration(p)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProfile(p.id)}
                    disabled={isDisabled}
                    title={isDisabled ? "Illustration needed — visit profile" : undefined}
                    style={{
                      position: "relative",
                      backgroundColor: isSelected ? "#f5f0ff" : "#ffffff",
                      border: isSelected ? "1.5px solid #7c3aed" : "1.5px solid #e9d5ff",
                      borderRadius: "11px",
                      padding: "9px 11px",
                      textAlign: "left",
                      ...(isDisabled ? { opacity: 0.45, cursor: "not-allowed" } : {}),
                    }}
                  >
                    {!isDisabled && profiles.length > 1 && (
                      <span
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          border: isSelected ? "1.5px solid #7c3aed" : "1.5px solid #e9d5ff",
                          backgroundColor: isSelected ? "#7c3aed" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: "bold",
                          color: "#ffffff",
                        }}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                    )}
                    <div className="font-medium text-sm pr-5">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{formatAge(p.age, p.age_months ?? 0)}</div>
                    {isDisabled && (
                      <div className="text-xs text-amber-600 mt-0.5">Illustration needed</div>
                    )}
                  </button>
                )
              })}
            </div>
            {FEATURES.multiProfile && profiles.length > 1 && (
              <p className="text-xs text-muted-foreground mt-2">
                Select multiple kids to have them all appear in the story together.
              </p>
            )}
          </div>

          {/* Story type selector */}
          {storyTypes.length > 0 && (
            <div>
              <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.6px", textTransform: "uppercase", color: "#c4b5fd", marginBottom: "8px" }}>
                Story type
              </p>
              <div className="grid grid-cols-2 gap-2">
                {storyTypes.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setStoryTypeId(type.id)
                      setStoryTypeExtraInput("")
                    }}
                    style={{
                      backgroundColor: storyTypeId === type.id ? "#f5f0ff" : "#ffffff",
                      border: storyTypeId === type.id ? "1.5px solid #7c3aed" : "1.5px solid #e9d5ff",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      textAlign: "left",
                    }}
                  >
                    <div className="font-medium text-sm">{STORY_TYPE_EMOJI[type.id] ?? "📖"} {type.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conditional extra input for story types that require it */}
          {selectedStoryType?.extra_input_label && (
            <div>
              <Label htmlFor="story-type-extra">{selectedStoryType.extra_input_label}</Label>
              <Input
                id="story-type-extra"
                placeholder={selectedStoryType.extra_input_hint ?? ""}
                value={storyTypeExtraInput}
                onChange={e => setStoryTypeExtraInput(e.target.value)}
              />
            </div>
          )}

          {/* Title */}
          <div>
            <Label htmlFor="custom-title">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="custom-title"
              placeholder="Leave blank to auto-generate"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
            />
          </div>

          {/* Story length */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.6px", textTransform: "uppercase", color: "#c4b5fd", marginBottom: "8px" }}>
              Story length
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(STORY_LENGTHS) as [StoryLength, typeof STORY_LENGTHS[StoryLength]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStoryLength(key)}
                  style={storyLength === key ? {
                    backgroundColor: "#7c3aed",
                    color: "#ffffff",
                    border: "1.5px solid #7c3aed",
                    borderRadius: "20px",
                    padding: "6px 16px",
                    fontSize: "13px",
                    fontWeight: 500,
                  } : {
                    backgroundColor: "#ffffff",
                    color: "#7c3aed",
                    border: "1.5px solid #e9d5ff",
                    borderRadius: "20px",
                    padding: "6px 16px",
                    fontSize: "13px",
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text density */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.6px", textTransform: "uppercase", color: "#c4b5fd", marginBottom: "8px" }}>
              Reading style
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.values(TEXT_DENSITIES) as TextDensity[]).map(density => (
                <button
                  key={density.id}
                  type="button"
                  onClick={() => setTextDensity(density.id)}
                  style={textDensity === density.id ? {
                    backgroundColor: "#7c3aed",
                    color: "#ffffff",
                    border: "1.5px solid #7c3aed",
                    borderRadius: "20px",
                    padding: "6px 16px",
                    fontSize: "13px",
                    fontWeight: 500,
                  } : {
                    backgroundColor: "#ffffff",
                    color: "#7c3aed",
                    border: "1.5px solid #e9d5ff",
                    borderRadius: "20px",
                    padding: "6px 16px",
                    fontSize: "13px",
                  }}
                >
                  {density.name}
                </button>
              ))}
            </div>
          </div>

          {/* Art style */}
          {artStyles.length > 0 && (
            <div>
              <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.6px", textTransform: "uppercase", color: "#c4b5fd", marginBottom: "8px" }}>
                Art style
              </p>
              <div className="flex flex-wrap gap-2">
                {artStyles.map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setArtStyleId(style.id)}
                    style={artStyleId === style.id ? {
                      backgroundColor: "#7c3aed",
                      color: "#ffffff",
                      border: "1.5px solid #7c3aed",
                      borderRadius: "20px",
                      padding: "6px 16px",
                      fontSize: "13px",
                      fontWeight: 500,
                    } : {
                      backgroundColor: "#ffffff",
                      color: "#7c3aed",
                      border: "1.5px solid #e9d5ff",
                      borderRadius: "20px",
                      padding: "6px 16px",
                      fontSize: "13px",
                    }}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Story idea */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.6px", textTransform: "uppercase", color: "#c4b5fd", marginBottom: "8px" }}>
              Your story idea
            </p>
            <textarea
              id="story-description"
              aria-label="What should the story be about?"
              rows={3}
              placeholder="e.g. going to the dentist for the first time, a dragon who is afraid of the dark, finding a secret door in the garden…"
              value={storyDescription}
              onChange={e => setStoryDescription(e.target.value)}
              style={{
                width: "100%",
                borderRadius: "12px",
                border: "1.5px solid #e9d5ff",
                padding: "12px",
                fontSize: "14px",
                backgroundColor: "#ffffff",
                color: "#2e1065",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>

          {/* Feedback — only shown when creating a version */}
          {parentStoryId && (
            <div>
              <Label htmlFor="feedback">Changes or feedback <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                id="feedback"
                rows={3}
                placeholder="Leave blank to generate a fresh version, or describe what you'd like changed..."
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  border: "1.5px solid #e9d5ff",
                  padding: "12px",
                  fontSize: "14px",
                  backgroundColor: "#ffffff",
                  color: "#2e1065",
                  resize: "vertical",
                  outline: "none",
                }}
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
              aria-label="Include images"
              aria-checked={includeImages}
              onClick={() => imagesAvailable && setIncludeImages(v => !v)}
              disabled={!imagesAvailable}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                includeImages ? "bg-primary" : "bg-input"
              } ${!imagesAvailable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  includeImages ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Wish cost preview */}
          <p className="text-center text-sm" style={{ color: "#a78bfa" }}>
            This story costs <span style={{ color: "#d97706", fontWeight: 600 }}>✦ {creditsNeeded} {creditsNeeded === 1 ? "wish" : "wishes"}</span>
          </p>

          {/* Insufficient credits warning */}
          {credits < creditsNeeded && (
            <p className="text-sm text-center" style={{ color: "#ef4444" }}>
              Not enough wishes. You need {creditsNeeded} but have {credits}.
            </p>
          )}

          {/* Generate button */}
          <button
            type="submit"
            onClick={generate}
            disabled={!canGenerate}
            style={{
              width: "100%",
              backgroundColor: canGenerate ? "#7c3aed" : "#e9d5ff",
              color: canGenerate ? "#ffffff" : "#a78bfa",
              borderRadius: "12px",
              padding: "14px",
              fontSize: "14px",
              fontWeight: 500,
              border: "none",
              cursor: canGenerate ? "pointer" : "not-allowed",
              transition: "background-color 0.15s",
            }}
          >
            ✦ Grant my wishes
          </button>

        </div>
      )}
    </div>
  )
}

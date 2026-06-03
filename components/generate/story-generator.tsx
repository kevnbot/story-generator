"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Info } from "lucide-react"
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
  profileThumbnailUrls?: Record<string, string>
  userName?: string | null
}

type StreamChunk =
  | { type: "chunk"; text: string }
  | { type: "status"; message: string }
  | { type: "done"; storyId: string | null; title: string; hasImages: boolean }
  | { type: "error"; message: string }

// ─── InfoPopover ──────────────────────────────────────────────────────────────
// Renders an (i) icon that shows a tooltip on click (mobile-friendly).

function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-muted-foreground hover:text-foreground transition-colors ml-1.5"
        aria-label="More information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-20 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg text-xs text-popover-foreground leading-relaxed">
          {text}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-1.5 right-2 text-muted-foreground hover:text-foreground text-[10px]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ─── StoryGenerator ───────────────────────────────────────────────────────────

export function StoryGenerator({
  profiles,
  artStyles,
  storyTypes = [],
  credits,
  imagesAvailable,
  parentStoryId,
  parentStoryTitle,
  defaultProfileIds = [],
  profileThumbnailUrls = {},
  userName,
}: StoryGeneratorProps) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const greetingWithName = userName ? `${greeting}, ${userName.split(" ")[0]}` : greeting

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
          <a href="/profile/new">Create a profile</a>
        </Button>
      </div>
    )
  }

  if (status === "generating") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
        <div className="text-5xl animate-bounce">✨</div>
        <div>
          <h2 className="text-xl font-semibold mb-1">
            {isIllustrating ? "Bringing your story to life..." : "Writing your story..."}
          </h2>
          {statusMessage && (
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          )}
        </div>
      </div>
    )
  }

  if (status === "done" && storyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
        <div className="text-5xl">🎉</div>
        <div>
          <h2 className="text-xl font-semibold mb-1">{storyTitle}</h2>
          <p className="text-sm text-muted-foreground">Your story is ready!</p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <a href={`/library/${storyId}`}>Read it now</a>
          </Button>
          <Button variant="outline" onClick={reset}>Make another</Button>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
        <div className="text-5xl">😔</div>
        <div>
          <h2 className="text-xl font-semibold mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <p className="text-sm font-medium" style={{ color: "#7c3aed" }}>{greetingWithName} ✦</p>
          <h1 className="text-2xl font-semibold text-foreground mt-0.5">What&apos;s your wish tonight?</h1>
          <p className="text-sm mt-1" style={{ color: "#a78bfa" }}>Your genie is ready to make magic</p>
        </div>
        <img src="/luma.png" alt="" className="w-24 h-24 object-contain flex-shrink-0 drop-shadow-sm" aria-hidden="true" />
      </div>

      {parentStoryTitle && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Continuing from: <span className="font-medium text-foreground">{parentStoryTitle}</span>
        </div>
      )}

      {/* ── 1. Character ── */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "#a78bfa" }}>Character</label>
        <div className="flex flex-wrap gap-2">
          {profiles.map(profile => {
            const isDisabled = !hasIllustration(profile)
            const isSelected = selectedIds.has(profile.id)
            const thumbnailUrl = profileThumbnailUrls[profile.id]

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => toggleProfile(profile.id)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isDisabled
                    ? "opacity-40 cursor-not-allowed border-input bg-background"
                    : isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-input bg-background hover:bg-accent"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl select-none">🧒</span>
                  )}
                </div>
                {/* Name only */}
                <span className="text-xs font-medium leading-tight max-w-[64px] text-center truncate">
                  {profile.name}
                </span>
                {isDisabled && (
                  <span className="text-[9px] text-amber-600 leading-tight text-center">
                    Needs illustration
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {FEATURES.multiProfile && profiles.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Select multiple kids to have them all appear in the story together.
          </p>
        )}
      </div>

      {/* ── 2. Story Type ── */}
      {storyTypes.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "#a78bfa" }}>Story type</label>
          <div className="grid grid-cols-2 gap-2">
            {storyTypes.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setStoryTypeId(type.id)
                  setStoryTypeExtraInput("")
                }}
                title={type.description}
                className={`group relative p-3 rounded-lg border text-left transition-colors ${
                  storyTypeId === type.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                <div className="font-medium text-sm">{type.name}</div>
                {/* Description shown on hover via a tooltip-style overlay */}
                <div className="pointer-events-none absolute inset-x-0 top-full mt-1.5 z-10 hidden group-hover:block">
                  <div className="mx-1 rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs text-popover-foreground leading-relaxed">
                    {type.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conditional extra input */}
      {selectedStoryType?.extra_input_label && (
        <div className="space-y-1.5">
          <Label htmlFor="story-type-extra">{selectedStoryType.extra_input_label}</Label>
          <Input
            id="story-type-extra"
            placeholder={selectedStoryType.extra_input_hint ?? ""}
            value={storyTypeExtraInput}
            onChange={e => setStoryTypeExtraInput(e.target.value)}
          />
        </div>
      )}

      {/* ── 3. Story Length ── */}
      <div className="space-y-2">
        <div className="flex items-center">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "#a78bfa" }}>Story length</label>
          <InfoPopover text="Controls the number of pages in the story. Short = 4 pages, Medium = 6 pages, Long = 8 pages. Longer stories also use more image wishes if illustrations are enabled." />
        </div>
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
              <div className="text-xs text-muted-foreground mt-0.5">{cfg.pages} pages</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. Reading Style ── */}
      <div className="space-y-2">
        <div className="flex items-center">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "#a78bfa" }}>Reading style</label>
          <InfoPopover text="Sets how much text appears on each page. Early Reader uses short, simple sentences great for young kids reading along. Read Together has more detail for reading with a parent. Read Aloud is richly written for a parent to narrate expressively." />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.values(TEXT_DENSITIES) as TextDensity[]).map(density => (
            <button
              key={density.id}
              type="button"
              onClick={() => setTextDensity(density.id)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                textDensity === density.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              <div className="font-medium text-sm">{density.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 5. Title ── */}
      <div className="space-y-1.5">
        <Label htmlFor="custom-title">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          id="custom-title"
          placeholder="Leave blank to auto-generate"
          value={customTitle}
          onChange={e => setCustomTitle(e.target.value)}
        />
      </div>

      {/* ── 6. Your Story Idea ── */}
      <div className="space-y-1.5">
        <Label htmlFor="story-description">Your story idea</Label>
        <textarea
          id="story-description"
          rows={3}
          placeholder="Describe what happens in the story — or leave blank and let the genie surprise you..."
          value={storyDescription}
          onChange={e => setStoryDescription(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* ── 7. Include Images ── */}
      {imagesAvailable && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Include illustrations</span>
          <button
            type="button"
            onClick={() => setIncludeImages(v => !v)}
            aria-pressed={includeImages}
            aria-label="Include illustrations"
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              includeImages ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                includeImages ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      )}

      {/* ── 8. Art Style ── */}
      {artStyles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "#a78bfa" }}>Art style</label>
            <InfoPopover text="Changes the illustration style used for your story's images. Each style gives the pictures a different look and feel — from soft watercolors to bold cartoon lines." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {artStyles.map(style => (
              <button
                key={style.id}
                type="button"
                onClick={() => setArtStyleId(style.id)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  artStyleId === style.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                <div className="font-medium text-sm">{style.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Wish cost ── */}
      <div className="text-sm text-muted-foreground">
        This story costs{" "}
        <span className="font-semibold text-amber-600">✦ {creditsNeeded} {creditsNeeded === 1 ? "wish" : "wishes"}</span>
        {" "}· You have{" "}
        <span className={credits < creditsNeeded ? "text-destructive font-semibold" : "font-semibold"}>
          {credits}
        </span>
      </div>

      {credits < creditsNeeded && (
        <p className="text-sm text-destructive">Not enough wishes. Purchase more to continue.</p>
      )}

      {/* ── Generate button ── */}
      <Button
        onClick={generate}
        disabled={!canGenerate}
        className="w-full"
        size="lg"
      >
        ✦ Grant my wishes
      </Button>
    </div>
  )
}

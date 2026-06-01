"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"
import { TEXT_DENSITIES, DEFAULT_TEXT_DENSITY, type TextDensityKey } from "@/lib/story-density"
import {
  DEFAULT_IMAGE_PROVIDER_ID,
  getImageProviderMetadata,
  listImageProviderMetadata,
  type ImageProviderMetadata,
} from "@/lib/ai/providers/image/options"
import { listTextProviders } from "@/lib/ai/providers/text/registry"
import { formatAge } from "@/lib/ai/prompt-builder"
import type { StoryVisualContext } from "@/lib/ai/prompt-builder/visual-context"
import type {
  WorkbenchArtStyle,
  WorkbenchInitialStory,
  WorkbenchProfile,
  WorkbenchStoryType,
} from "@/lib/admin/workbench-preload"

// ─── Interfaces ───────────────────────────────────────────────────────────────

type Profile = WorkbenchProfile
type StoryType = WorkbenchStoryType
type ArtStyle = WorkbenchArtStyle

interface StoryGenerationTabProps {
  profiles: Profile[]
  storyTypes: StoryType[]
  artStyles: ArtStyle[]
  initialStory?: WorkbenchInitialStory | null
}

interface BuildPromptsResult {
  systemPrompt: string
  userPrompt: string
  storyTypeContribution: {
    systemPromptSuffix: string
    structureTemplate: string
    pageGuidance: { first: string; middle: string; last: string }
  }
  tokenCounts: {
    system: number
    user: number
    combined: number
    contextWindowPercent: number
  }
  meta: {
    profileCount: number
    storyTypeId: string
    storyTypeName: string
    storyLength: string
    textDensity: string
    pageCount: number
  }
}

interface TextResult {
  fullText: string
  durationMs: number
  model: string
}

interface VisualResult {
  visualContext: StoryVisualContext
  meta: {
    parseSuccess: boolean
    durationMs: number
    model: string
    pageCount: number
    storyCharactersFound: number
  }
}

interface ImageAttemptLog {
  attempt: number
  resultUrl: string | null
  isBlackImage: boolean
  contentLengthBytes: number | null
  rejectionReason: string | null
  backoffMs: number | null
}

interface GeneratedImageResult {
  pageIndex: number
  url: string | null
  isErrorPlaceholder: boolean
  provider: string
  model: string
  referenceUsed: boolean
  attempts: number
  attemptsLog: ImageAttemptLog[]
  isBlackImage: boolean
  contentLengthBytes: number | null
  rawResponseStatus: number | null
  error: string | null
  durationMs: number
}

interface BuildReferenceResult {
  profileRefs: { profileId: string; name: string; url: string | null; storageField: string }[]
  referenceImageUrls: string[]
  referenceImageLabels: string[]
  compositingSteps: {
    addedProfileName: string
    prompt: string
    model: string
    resultUrl: string
    durationMs: number
    success: boolean
    error: string | null
  }[]
  baseReferenceUrl: string | null
  styleTransfer: {
    inputUrl: string
    artStylePrefix: string
    model: string
    resultUrl: string
    durationMs: number
    success: boolean
  } | null
  styledReferenceUrl: string | null
}

// ─── Local page splitter (mirrors lib/ai/story.ts — safe to copy here) ───────

const PAGE_BREAK_RE = /^[-–—*\s]*(?:\*{0,2})\s*Page\s+\d+\s*(?:\*{0,2})[-–—*\s]*$/im

function splitPages(content: string): string[] {
  const lines = content.split("\n")
  const sections: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (PAGE_BREAK_RE.test(line)) {
      const section = current.join("\n").trim()
      if (section) sections.push(section)
      current = []
    } else {
      current.push(line)
    }
  }
  const last = current.join("\n").trim()
  if (last) sections.push(last)

  if (sections.length > 1) return sections
  return content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIllustrationStatus(profile: Profile): "ready" | "pending" | "missing" {
  if (profile.combined_reference_path || profile.character_illustration_path || profile.reference_image_path || profile.reference_image_url) return "ready"
  if (profile.illustration_status === "pending" || profile.illustration_status === "generating") return "pending"
  return "missing"
}

function getProfileReferencePreviewUrl(profile: Profile): string | null {
  return profile.combined_reference_url
    ?? profile.character_illustration_url
    ?? profile.reference_image_url
    ?? null
}

function getStorageField(profile: Profile): string {
  if (profile.combined_reference_path) return "combined_reference_path"
  if (profile.character_illustration_path) return "character_illustration_path"
  if (profile.reference_image_path) return "reference_image_path"
  return "none"
}

function storageFieldBadge(field: string): { label: string; className: string } {
  switch (field) {
    case "combined_reference_path": return { label: "combined", className: "bg-green-100 text-green-700" }
    case "character_illustration_path": return { label: "illustration", className: "bg-blue-100 text-blue-700" }
    case "reference_image_path": return { label: "reference", className: "bg-muted text-muted-foreground" }
    case "reference_image_url": return { label: "URL", className: "bg-muted text-muted-foreground" }
    default: return { label: "none", className: "bg-red-100 text-red-700" }
  }
}

function getImageProviderDisabledReason(provider: ImageProviderMetadata, selectedProfileCount: number): string | null {
  if (provider.referenceMode === "single" && selectedProfileCount > 1) {
    return `${provider.label} supports only one selected profile.`
  }
  if (provider.maxReferenceImages !== null && selectedProfileCount > provider.maxReferenceImages) {
    return `${provider.label} supports at most ${provider.maxReferenceImages} selected profiles.`
  }
  return null
}

function formatReferenceMode(provider: ImageProviderMetadata): string {
  if (!provider.supportsReferenceImages || provider.referenceMode === "none") return "No reference images"
  if (provider.referenceMode === "single") return "1 reference image"
  if (provider.maxReferenceImages !== null) return `Up to ${provider.maxReferenceImages} reference images`
  return "Multiple reference images"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IllustrationStatusBadge({ profile }: { profile: Profile }) {
  const status = getIllustrationStatus(profile)
  const cls = {
    ready: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    missing: "bg-red-100 text-red-700",
  }[status]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  )
}

function SelectionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-lg border text-left transition-colors w-full ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-input bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  )
}

function ProfileCard({ profile }: { profile: Profile }) {
  const app = profile.appearance ?? {}
  const hasAppearanceDetails = !!(app.hair || app.hair_color || app.eye_color || app.skin_tone)
  const previewUrl = getProfileReferencePreviewUrl(profile)

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{profile.name}</h3>
          <p className="text-sm text-muted-foreground">
            {formatAge(profile.age, profile.age_months)}
            {profile.gender ? ` · ${profile.gender}` : ""}
          </p>
        </div>
        <IllustrationStatusBadge profile={profile} />
      </div>

      {hasAppearanceDetails && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Appearance</p>
          <div className="space-y-0.5 text-sm">
            {(app.hair || app.hair_color) && (
              <div>Hair: {app.hair ?? [app.hair_color, app.hair_style].filter(Boolean).join(", ")}</div>
            )}
            {app.eye_color && <div>Eyes: {app.eye_color}</div>}
            {app.skin_tone && <div>Skin: {app.skin_tone}</div>}
          </div>
        </div>
      )}

      {(profile.personality_tags?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Personality</p>
          <div className="flex flex-wrap gap-1">
            {profile.personality_tags!.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-xs">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {profile.toy?.name && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Companion</p>
          <p className="text-sm">
            {profile.toy.name}
            {profile.toy.description ? `: ${profile.toy.description}` : ""}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reference Image</p>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`${profile.name} reference`}
            className="w-24 h-24 rounded-lg object-cover"
          />
        ) : (
          <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground text-center px-2">
            No reference image
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">Source: {getStorageField(profile)}</p>
      </div>
    </div>
  )
}

function PromptPreBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground">
        {content}
      </pre>
    </div>
  )
}

function Stage1Card({ result }: { result: BuildPromptsResult }) {
  const [showStoryType, setShowStoryType] = useState(false)
  const [showSystem, setShowSystem] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [copiedSystem, setCopiedSystem] = useState(false)
  const [copiedUser, setCopiedUser] = useState(false)

  const { tokenCounts } = result
  const isHighUsage = tokenCounts.contextWindowPercent > 20

  function copyText(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 1 — Prompt Builder</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
          ✓ complete
        </span>
      </div>

      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span>System: <span className="font-mono font-medium">{tokenCounts.system.toLocaleString()}</span> tokens</span>
          <span className="text-muted-foreground">·</span>
          <span>User: <span className="font-mono font-medium">{tokenCounts.user.toLocaleString()}</span> tokens</span>
          <span className="text-muted-foreground">·</span>
          <span>Combined: <span className="font-mono font-medium">{tokenCounts.combined.toLocaleString()}</span> tokens</span>
          <span className="text-muted-foreground">({tokenCounts.contextWindowPercent}% of context window)</span>
          {isHighUsage && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-medium">
              ⚠ High token usage
            </span>
          )}
        </div>
      </div>

      <div className="border-b border-border">
        <button
          type="button"
          onClick={() => setShowStoryType(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <span>Story Type Contribution</span>
          {showStoryType ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showStoryType && (
          <div className="px-4 pb-4 space-y-3">
            <PromptPreBlock label="System Prompt Suffix" content={result.storyTypeContribution.systemPromptSuffix} />
            <PromptPreBlock label="Structure Template" content={result.storyTypeContribution.structureTemplate} />
            <PromptPreBlock label="Opening Pages" content={result.storyTypeContribution.pageGuidance.first} />
            <PromptPreBlock label="Middle Pages" content={result.storyTypeContribution.pageGuidance.middle} />
            <PromptPreBlock label="Final Pages" content={result.storyTypeContribution.pageGuidance.last} />
          </div>
        )}
      </div>

      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowSystem(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors"
          >
            {showSystem ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            System Prompt
          </button>
          <button
            type="button"
            onClick={() => copyText(result.systemPrompt, setCopiedSystem)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded px-2 py-0.5 hover:bg-muted transition-colors"
          >
            {copiedSystem ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedSystem ? "Copied" : "Copy"}
          </button>
        </div>
        {showSystem && (
          <div className="px-4 pb-4">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 bg-muted/40 rounded-lg font-mono text-[12px] leading-relaxed text-foreground">
              {result.systemPrompt}
            </pre>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowUser(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors"
          >
            {showUser ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            User Prompt
          </button>
          <button
            type="button"
            onClick={() => copyText(result.userPrompt, setCopiedUser)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded px-2 py-0.5 hover:bg-muted transition-colors"
          >
            {copiedUser ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedUser ? "Copied" : "Copy"}
          </button>
        </div>
        {showUser && (
          <div className="px-4 pb-4">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 bg-muted/40 rounded-lg font-mono text-[12px] leading-relaxed text-foreground">
              {result.userPrompt}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function Stage2Card({
  result,
  pages,
  onPagesChange,
  onRegenerate,
}: {
  result: TextResult
  pages: string[]
  onPagesChange: (pages: string[]) => void
  onRegenerate: () => void
}) {
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 2 — Story Text</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
          ✓ complete
        </span>
        <button
          type="button"
          onClick={onRegenerate}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground rounded px-2 py-0.5 hover:bg-muted transition-colors"
        >
          Re-generate
        </button>
      </div>

      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span>Model: <span className="font-mono font-medium">{result.model}</span></span>
          <span className="text-muted-foreground">·</span>
          <span>Duration: <span className="font-mono font-medium">{(result.durationMs / 1000).toFixed(1)}s</span></span>
          <span className="text-muted-foreground">·</span>
          <span>Pages split: <span className="font-mono font-medium">{pages.length}</span></span>
        </div>
      </div>

      <div className="border-b border-border">
        <button
          type="button"
          onClick={() => setShowRaw(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <span>Raw Text</span>
          {showRaw ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showRaw && (
          <div className="px-4 pb-4">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 bg-muted/40 rounded-lg font-mono text-[12px] leading-relaxed text-foreground">
              {result.fullText}
            </pre>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pages (editable)</p>
        {pages.map((page, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs text-muted-foreground">Page {i + 1}</p>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              rows={4}
              value={page}
              onChange={e => {
                const updated = [...pages]
                updated[i] = e.target.value
                onPagesChange(updated)
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const MOOD_COLORS: Record<string, string> = {
  warm: "bg-orange-100 text-orange-700",
  joyful: "bg-yellow-100 text-yellow-700",
  mysterious: "bg-purple-100 text-purple-700",
  calm: "bg-blue-100 text-blue-700",
  exciting: "bg-red-100 text-red-700",
  silly: "bg-green-100 text-green-700",
}

function Stage3Card({ result, onRerun }: { result: VisualResult; onRerun: () => void }) {
  const [showRaw, setShowRaw] = useState(false)
  const { visualContext, meta } = result

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 3 — Visual Context</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
          ✓ complete
        </span>
        <button
          type="button"
          onClick={onRerun}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground rounded px-2 py-0.5 hover:bg-muted transition-colors"
        >
          Re-run extraction
        </button>
      </div>

      <div className={`px-4 py-2 border-b border-border text-xs flex items-center gap-2 ${
        meta.parseSuccess ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
      }`}>
        <span>{meta.parseSuccess ? "✓ JSON parsed successfully" : "⚠ Parse failed — using fallback"}</span>
        <span className="ml-auto text-muted-foreground">
          {meta.model} · {(meta.durationMs / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="divide-y divide-border">
        <div className="px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Setting</p>
          <p className="text-sm">{visualContext.setting || "—"}</p>
          <p className="text-xs text-muted-foreground">Time of day: {visualContext.timeOfDay}</p>
          {visualContext.recurringElements.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Recurring elements: {visualContext.recurringElements.join(", ")}
            </p>
          )}
        </div>

        {Object.keys(visualContext.outfits).length > 0 && (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outfits</p>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(visualContext.outfits).map(([name, outfit]) => (
                  <tr key={name} className="border-t border-border first:border-t-0">
                    <td className="py-1 pr-3 font-medium w-24 align-top">{name}</td>
                    <td className="py-1 text-muted-foreground">{outfit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visualContext.storyCharacters.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Story Characters ({visualContext.storyCharacters.length})
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-3 font-medium text-muted-foreground w-24">Name</th>
                  <th className="text-left py-1 pr-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left py-1 font-medium text-muted-foreground w-16">Pages</th>
                </tr>
              </thead>
              <tbody>
                {visualContext.storyCharacters.map(sc => (
                  <tr key={sc.name} className="border-t border-border">
                    <td className="py-1 pr-3 font-medium align-top">{sc.name}</td>
                    <td className="py-1 pr-3 text-muted-foreground align-top">{sc.description}</td>
                    <td className="py-1 text-muted-foreground align-top">
                      {sc.appearsOnPages.map(i => i + 1).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Page Scenes</p>
          {visualContext.pageScenes.map(scene => (
            <div key={scene.pageIndex} className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">Page {scene.pageIndex + 1}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  MOOD_COLORS[scene.mood] ?? "bg-muted text-muted-foreground"
                }`}>
                  {scene.mood}
                </span>
                {scene.characters.length > 0 && (
                  <span className="text-xs text-muted-foreground">{scene.characters.join(", ")}</span>
                )}
              </div>
              <p className="text-sm">{scene.action}</p>
              {scene.setting && <p className="text-xs text-muted-foreground italic">{scene.setting}</p>}
              {scene.toys.length > 0 && (
                <p className="text-xs text-muted-foreground">Toys: {scene.toys.join(", ")}</p>
              )}
            </div>
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowRaw(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span>Raw JSON</span>
            {showRaw ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showRaw && (
            <div className="px-4 pb-4">
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 bg-muted/40 rounded-lg font-mono text-[12px] leading-relaxed text-foreground">
                {JSON.stringify(visualContext, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompositingStepRow({ step }: { step: BuildReferenceResult["compositingSteps"][number] }) {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium">Adding {step.addedProfileName}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
          step.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {step.success ? "✓ success" : "✗ failed"}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">{(step.durationMs / 1000).toFixed(1)}s</span>
      </div>

      {step.error && (
        <p className="text-xs text-destructive">{step.error}</p>
      )}

      <button
        type="button"
        onClick={() => setShowPrompt(v => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Compositing prompt
      </button>
      {showPrompt && (
        <pre className="whitespace-pre-wrap break-words px-3 py-2 bg-muted/40 rounded-lg font-mono text-[11px] leading-relaxed text-foreground">
          {step.prompt}
        </pre>
      )}

      {step.success && step.resultUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={step.resultUrl}
          alt={`After adding ${step.addedProfileName}`}
          className="w-full rounded-lg object-cover max-h-48"
        />
      )}
    </div>
  )
}

function Stage4Card({
  result,
  onRerun,
}: {
  result: BuildReferenceResult
  onRerun: () => void
}) {
  const finalUrl = result.styledReferenceUrl ?? result.baseReferenceUrl

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 4 — Reference Resolver</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
          ✓ complete
        </span>
        <button
          type="button"
          onClick={onRerun}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground rounded px-2 py-0.5 hover:bg-muted transition-colors"
        >
          Re-run references
        </button>
      </div>

      <div className="divide-y divide-border">
        {/* 4a — Individual References */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">4a — Individual References</p>
          <div className="grid grid-cols-2 gap-3">
            {result.profileRefs.map(ref => {
              const badge = storageFieldBadge(ref.storageField)
              return (
                <div key={ref.profileId} className="rounded-lg border bg-background p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{ref.name}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  {ref.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ref.url}
                      alt={`${ref.name} reference`}
                      className="w-full rounded-lg object-cover max-h-32"
                    />
                  ) : (
                    <div className="w-full rounded-lg bg-red-50 border border-red-200 flex items-center justify-center py-6 text-xs text-red-600">
                      No reference image
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 4b — Compositing Steps */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">4b — Composite Reference</p>
          {result.compositingSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No composite generated. Multi-reference providers receive the individual profile references above.
            </p>
          ) : (
            result.compositingSteps.map((step, i) => (
              <CompositingStepRow key={i} step={step} />
            ))
          )}
        </div>

        {/* 4c — Style Transfer */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">4c — Style Transfer</p>
          {result.styleTransfer ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-mono">{result.styleTransfer.artStylePrefix}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                  result.styleTransfer.success ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {result.styleTransfer.success ? "✓ applied" : "⚠ unchanged"}
                </span>
                <span>{(result.styleTransfer.durationMs / 1000).toFixed(1)}s</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">Before</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.styleTransfer.inputUrl} alt="Before style transfer" className="w-full rounded-lg object-cover" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">After</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.styleTransfer.resultUrl} alt="After style transfer" className="w-full rounded-lg object-cover" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Skipped — art style is applied in the page image prompts.</p>
          )}
        </div>

        {/* Final reference image */}
        {finalUrl && (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              First reference image
            </p>
            <p className="text-xs text-muted-foreground">
              Single-reference providers use this image. Multi-reference providers use all resolved profile references.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={finalUrl} alt="Final reference image" className="w-full rounded-lg object-cover" />
          </div>
        )}

      </div>
    </div>
  )
}

function Stage5Card({
  prompts,
  scenes,
  onPromptsChange,
}: {
  prompts: string[]
  scenes: StoryVisualContext["pageScenes"]
  onPromptsChange: (prompts: string[]) => void
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 5 — Image Prompt Builder</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
          ✓ complete
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{prompts.length} prompts</span>
      </div>

      <div className="divide-y divide-border">
        {prompts.map((prompt, i) => {
          const scene = scenes[i]
          const tokens = Math.ceil(prompt.length / 4)
          return (
            <div key={i} className="px-4 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Page {i + 1}</span>
                <span className="text-xs text-muted-foreground font-mono">{tokens.toLocaleString()} tokens</span>
                {scene?.characters && scene.characters.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">{scene.characters.join(", ")}</span>
                )}
              </div>

              {scene?.text && (
                <p className="text-xs text-muted-foreground italic line-clamp-2">{scene.text}</p>
              )}

              <textarea
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                rows={4}
                value={prompt}
                onChange={e => {
                  const updated = [...prompts]
                  updated[i] = e.target.value
                  onPromptsChange(updated)
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stage6Card({
  results,
  pages,
  totalImages,
  isLoading,
  progress,
  onRerunPage,
}: {
  results: GeneratedImageResult[]
  pages: string[]
  totalImages: number
  isLoading: boolean
  progress: number
  onRerunPage: (pageIndex: number) => void
}) {
  const [expandedMeta, setExpandedMeta] = useState<number | null>(null)

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 6 — Image Generation</span>
        {isLoading ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">
            ● generating {progress}/{totalImages}
          </span>
        ) : (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
            ✓ complete
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{results.length} of {totalImages}</span>
      </div>

      <div className="divide-y divide-border">
        {results.map(result => (
          <div key={result.pageIndex} className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">Page {result.pageIndex + 1}</span>
              {result.isErrorPlaceholder ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">
                  Error placeholder
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
                  ✓ Success
                </span>
              )}
              <button
                type="button"
                onClick={() => onRerunPage(result.pageIndex)}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground rounded px-2 py-0.5 hover:bg-muted transition-colors"
              >
                Re-run this page
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                {pages[result.pageIndex] && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
                    {pages[result.pageIndex]}
                  </p>
                )}
              </div>
              <div>
                {result.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.url}
                    alt={`Page ${result.pageIndex + 1}`}
                    className="w-full rounded-lg object-cover"
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpandedMeta(expandedMeta === result.pageIndex ? null : result.pageIndex)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expandedMeta === result.pageIndex
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />}
              Metadata
            </button>

            {expandedMeta === result.pageIndex && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                <p>Provider: {result.provider}</p>
                <p>Model: {result.model || "—"}</p>
                <p>Reference used: {result.referenceUsed ? "✓" : "✗"}</p>
                <p>Attempts: {result.attempts}</p>
                <p>Black image detected: {result.isBlackImage ? "Yes" : "No"}</p>
                {result.rawResponseStatus !== null && <p>HTTP status: {result.rawResponseStatus}</p>}
                <p>Duration: {(result.durationMs / 1000).toFixed(1)}s</p>
                {result.error && <p className="text-destructive">Error: {result.error}</p>}
                {result.attemptsLog.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="font-medium">Attempts log:</p>
                    {result.attemptsLog.map(log => (
                      <div key={log.attempt} className="pl-2 border-l border-border space-y-0.5">
                        <p>Attempt {log.attempt}: {log.resultUrl ? "✓ url" : "✗ null"}</p>
                        {log.isBlackImage && <p className="text-yellow-700">black image detected</p>}
                        {log.rejectionReason && <p>reason: {log.rejectionReason}</p>}
                        {log.backoffMs !== null && <p>backoff: {log.backoffMs}ms</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Stage7Card({
  storyTitle,
  onTitleChange,
  storyLength,
  includeImages,
  savedStoryId,
  saveLoading,
  saveError,
  saveDisabledReason,
  onSave,
}: {
  storyTitle: string
  onTitleChange: (v: string) => void
  storyLength: StoryLength
  includeImages: boolean
  savedStoryId: string | null
  saveLoading: boolean
  saveError: string | null
  saveDisabledReason?: string | null
  onSave: () => void
}) {
  const imageCost = includeImages ? STORY_LENGTHS[storyLength].imageCost : 0

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 7 — Save as Story</span>
        {savedStoryId && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
            ✓ saved
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Story Title</p>
          <input
            type="text"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={storyTitle}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Enter story title…"
          />
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
          <p className="font-medium mb-1">Credit cost</p>
          <p>Base text generation: 1 credit</p>
          {includeImages && imageCost > 0 && (
            <p>Images ({storyLength}): {imageCost} credits</p>
          )}
          <p className="font-semibold border-t border-border pt-1 mt-1">
            Total: {1 + imageCost} credits
          </p>
        </div>

        {savedStoryId ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
            <p className="text-sm text-green-700 font-medium">Story saved successfully!</p>
            <a
              href={`/library/${savedStoryId}`}
              className="text-sm text-green-600 underline hover:text-green-800"
            >
              View story in library →
            </a>
          </div>
        ) : (
          <>
            <Button onClick={onSave} disabled={saveLoading || Boolean(saveDisabledReason)} className="w-full">
              {saveDisabledReason
                ? "Save disabled for imported log"
                : saveLoading
                ? "Saving…"
                : `Save as Story — deducts ${1 + imageCost} credits`}
            </Button>
            {saveDisabledReason && (
              <p className="text-xs text-muted-foreground">{saveDisabledReason}</p>
            )}
            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SourceContextBanner({ context }: { context: NonNullable<WorkbenchInitialStory["sourceContext"]> }) {
  const createdLabel = new Date(context.storyCreatedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  const userLabel = context.userDisplayName
    ? `${context.userDisplayName}${context.userEmail ? ` (${context.userEmail})` : ""}`
    : context.userEmail ?? context.userId
  const accountLabel = context.accountName
    ? `${context.accountName} (${context.accountId})`
    : context.accountId

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Imported prompt log</span>
        <span>{context.storyTitle}</span>
        <span className="font-mono text-xs text-amber-800">{context.storyId}</span>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-amber-900 sm:grid-cols-2">
        <p>User: {userLabel}</p>
        <p>Account: {accountLabel}</p>
        <p>Generated: {createdLabel}</p>
        <p>Saving: disabled for imported logs</p>
      </div>
      {(context.missingFields.length > 0 || context.archivedProfileNames.length > 0) && (
        <div className="mt-2 space-y-1 text-xs text-amber-900">
          {context.archivedProfileNames.length > 0 && (
            <p>Archived source profiles: {context.archivedProfileNames.join(", ")}</p>
          )}
          {context.missingFields.length > 0 && (
            <p>Replay notes: {context.missingFields.join(" ")}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoryGenerationTab({ profiles, storyTypes, artStyles, initialStory }: StoryGenerationTabProps) {
  const sourceContext = initialStory?.sourceContext ?? null
  const saveDisabledReason = initialStory?.saveDisabledReason ?? null
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(initialStory?.selectedProfileIds ?? [])
  const [storyTypeId, setStoryTypeId] = useState<string>(initialStory?.storyTypeId ?? storyTypes[0]?.id ?? "")
  const [storyLength, setStoryLength] = useState<StoryLength>(initialStory?.storyLength ?? "medium")
  const [textDensity, setTextDensity] = useState<TextDensityKey>(initialStory?.textDensity ?? DEFAULT_TEXT_DENSITY)
  const [storyDescription, setStoryDescription] = useState(initialStory?.storyDescription ?? "")
  const [extraInput, setExtraInput] = useState(initialStory?.extraInput ?? "")
  const [artStyleId, setArtStyleId] = useState<string>(initialStory?.artStyleId ?? artStyles[0]?.id ?? "")
  const [textProvider, setTextProvider] = useState(initialStory?.textProvider ?? "anthropic")
  const [imageProvider, setImageProvider] = useState(initialStory?.imageProvider ?? DEFAULT_IMAGE_PROVIDER_ID)
  const [includeImages, setIncludeImages] = useState(initialStory?.includeImages ?? true)

  // Stage 1
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [promptsResult, setPromptsResult] = useState<BuildPromptsResult | null>(initialStory?.promptsResult ?? null)
  const [promptsError, setPromptsError] = useState<string | null>(null)

  // Stage 2
  const [textLoading, setTextLoading] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [textResult, setTextResult] = useState<TextResult | null>(initialStory?.textResult ?? null)
  const [textError, setTextError] = useState<string | null>(null)
  const [storyPages, setStoryPages] = useState<string[]>(initialStory?.storyPages ?? [])

  // Stage 3
  const [visualLoading, setVisualLoading] = useState(false)
  const [visualResult, setVisualResult] = useState<VisualResult | null>(null)
  const [visualError, setVisualError] = useState<string | null>(null)

  // Stage 4
  const [referenceLoading, setReferenceLoading] = useState(false)
  const [referenceResult, setReferenceResult] = useState<BuildReferenceResult | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)

  // Stage 5
  const [imagePrompts, setImagePrompts] = useState<string[] | null>(initialStory?.imagePrompts ?? null)

  // Stage 6
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imagesProgress, setImagesProgress] = useState(initialStory?.generatedImages?.length ?? 0)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageResult[] | null>(initialStory?.generatedImages ?? null)
  const [imagesError, setImagesError] = useState<string | null>(null)

  // Stage 7
  const [storyTitle, setStoryTitle] = useState(initialStory?.storyTitle ?? "")
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const textProviders = listTextProviders()
  const imageProviders = listImageProviderMetadata()
  const selectedStoryType = storyTypes.find(t => t.id === storyTypeId) ?? null
  const showExtraInput = selectedStoryType
    ? (selectedStoryType.occasion_required === true || selectedStoryType.extra_input_label !== null)
    : false
  const selectedProfiles = profiles.filter(p => selectedProfileIds.includes(p.id))
  const selectedIncludesArchivedProfiles = selectedProfiles.some(p => Boolean(p.deleted_at))
  const providerCtx = getImageProviderMetadata(imageProvider)
  const canBuildPrompts = selectedProfileIds.length > 0 && !!storyTypeId && !promptsLoading && !selectedIncludesArchivedProfiles
  const canGenerateText = !!promptsResult && !textLoading && !promptsLoading
  const canExtractVisual = storyPages.length > 0 && !visualLoading && !textLoading
  const canBuildReference = selectedProfileIds.length > 0 && !referenceLoading && !selectedIncludesArchivedProfiles
  const canGenerateImages = !!imagePrompts && !!referenceResult && includeImages && !imagesLoading && !referenceLoading
  const canSaveStory = !!textResult && !saveLoading && (!includeImages || !!generatedImages) && !saveDisabledReason

  function toggleProfile(id: string) {
    const next = selectedProfileIds.includes(id)
      ? selectedProfileIds.filter(x => x !== id)
      : [...selectedProfileIds, id]
    setSelectedProfileIds(next)
    if (getImageProviderDisabledReason(getImageProviderMetadata(imageProvider), next.length)) {
      setImageProvider(DEFAULT_IMAGE_PROVIDER_ID)
    }
  }

  function reset() {
    setPromptsResult(null)
    setPromptsError(null)
    setTextLoading(false)
    setStreamingText("")
    setTextResult(null)
    setTextError(null)
    setStoryPages([])
    setVisualLoading(false)
    setVisualResult(null)
    setVisualError(null)
    setReferenceLoading(false)
    setReferenceResult(null)
    setReferenceError(null)
    setImagePrompts(null)
    setImagesLoading(false)
    setImagesProgress(0)
    setGeneratedImages(null)
    setImagesError(null)
    setStoryTitle("")
    setSaveLoading(false)
    setSavedStoryId(null)
    setSaveError(null)
  }

  async function triggerBuildImagePrompts(vc: StoryVisualContext, rr: BuildReferenceResult) {
    setImagePrompts(null)
    const referencesAvailable = providerCtx.supportsReferenceImages && rr.referenceImageUrls.length > 0
    try {
      const res = await fetch("/api/workbench/build-image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualContext: vc,
          artStyleId,
          profileIds: selectedProfileIds,
          referenceAvailable: referencesAvailable,
          imageProvider,
          referenceImageLabels: rr.referenceImageLabels,
        }),
      })
      const data = await res.json()
      if (res.ok) setImagePrompts((data as { prompts: string[] }).prompts)
    } catch {
      // silent — Stage 5 auto-build; user can change settings and re-run Stage 4 or 3 to retry
    }
  }

  async function buildPrompts() {
    setPromptsLoading(true)
    setPromptsError(null)
    try {
      const res = await fetch("/api/workbench/build-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileIds: selectedProfileIds,
          storyTypeId,
          storyLength,
          textDensity,
          storyDescription: storyDescription.trim() || undefined,
          extraInput: extraInput.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPromptsError(data.error ?? "Failed to build prompts")
      } else {
        setPromptsResult(data as BuildPromptsResult)
      }
    } catch {
      setPromptsError("Network error. Please try again.")
    } finally {
      setPromptsLoading(false)
    }
  }

  async function generateText() {
    if (!promptsResult) return
    setTextLoading(true)
    setStreamingText("")
    setTextError(null)
    setTextResult(null)
    setStoryPages([])

    try {
      const res = await fetch("/api/workbench/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: promptsResult.systemPrompt,
          userPrompt: promptsResult.userPrompt,
        }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        setTextError((data as { error?: string }).error ?? "Failed to generate story")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""
      let doneData: { durationMs: number; model: string } | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line) as { type: string; text?: string; durationMs?: number; model?: string; message?: string }
            if (msg.type === "chunk" && msg.text) {
              fullText += msg.text
              setStreamingText(fullText)
            } else if (msg.type === "done" && msg.durationMs !== undefined && msg.model) {
              doneData = { durationMs: msg.durationMs, model: msg.model }
            } else if (msg.type === "error") {
              setTextError(msg.message ?? "Generation failed")
            }
          } catch {
            // ignore malformed lines
          }
        }
      }

      if (fullText && doneData) {
        const titleMatch = fullText.match(/^Title:\s*(.+?)(?:\r?\n|$)/im)
        const extracted = titleMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""
        const cleanText = extracted
          ? fullText.replace(/^Title:\s*.+?(?:\r?\n)+/im, "").trim()
          : fullText
        const pages = splitPages(cleanText)
        setTextResult({ fullText: cleanText, ...doneData })
        setStoryPages(pages)
        setStoryTitle(extracted)
        setStreamingText("")
      }
    } catch {
      setTextError("Network error. Please try again.")
    } finally {
      setTextLoading(false)
    }
  }

  async function extractVisualCtx() {
    if (!storyPages.length) return
    setVisualLoading(true)
    setVisualError(null)
    setVisualResult(null)

    const characterNames = selectedProfiles.map(p => p.name)
    const toyNames = selectedProfiles.map(p => p.toy?.name).filter((n): n is string => !!n)
    const artStyle = artStyles.find(s => s.id === artStyleId)
    const artStyleDescription = artStyle?.name ?? "classic children's picture book"

    try {
      const res = await fetch("/api/workbench/extract-visual-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyPages, characterNames, toyNames, artStyleDescription }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVisualError((data as { error?: string }).error ?? "Failed to extract visual context")
      } else {
        const vr = data as VisualResult
        setVisualResult(vr)
        if (referenceResult) {
          await triggerBuildImagePrompts(vr.visualContext, referenceResult)
        }
      }
    } catch {
      setVisualError("Network error. Please try again.")
    } finally {
      setVisualLoading(false)
    }
  }

  async function buildReference() {
    if (!selectedProfileIds.length) return
    setReferenceLoading(true)
    setReferenceError(null)
    setReferenceResult(null)
    setImagePrompts(null)

    try {
      const res = await fetch("/api/workbench/build-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: selectedProfileIds, artStyleId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReferenceError((data as { error?: string }).error ?? "Failed to build reference image")
      } else {
        const rr = data as BuildReferenceResult
        setReferenceResult(rr)
        if (visualResult) {
          await triggerBuildImagePrompts(visualResult.visualContext, rr)
        }
      }
    } catch {
      setReferenceError("Network error. Please try again.")
    } finally {
      setReferenceLoading(false)
    }
  }

  async function generateImages() {
    if (!imagePrompts) return
    setImagesLoading(true)
    setImagesProgress(0)
    setImagesError(null)
    const referenceImageUrls = referenceResult?.referenceImageUrls ?? []
    const referenceImageLabels = referenceResult?.referenceImageLabels ?? []
    const referenceUrl = referenceImageUrls[0] ?? referenceResult?.styledReferenceUrl ?? referenceResult?.baseReferenceUrl ?? null
    const results: GeneratedImageResult[] = []

    for (let i = 0; i < imagePrompts.length; i++) {
      try {
        const res = await fetch("/api/workbench/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompts[i],
            referenceImageUrl: referenceUrl,
            referenceImageUrls,
            referenceImageLabels,
            imageProvider,
            pageIndex: i,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          results.push(data as GeneratedImageResult)
        } else {
          results.push({
            pageIndex: i, url: "/images/story-image-error.svg", isErrorPlaceholder: true,
            provider: providerCtx.label, model: providerCtx.modelId, referenceUsed: false, attempts: 0,
            attemptsLog: [], isBlackImage: false, contentLengthBytes: null,
            rawResponseStatus: null, error: (data as { error?: string }).error ?? "Failed", durationMs: 0,
          })
        }
      } catch {
        results.push({
          pageIndex: i, url: "/images/story-image-error.svg", isErrorPlaceholder: true,
          provider: providerCtx.label, model: providerCtx.modelId, referenceUsed: false, attempts: 0,
          attemptsLog: [], isBlackImage: false, contentLengthBytes: null,
          rawResponseStatus: null, error: "Network error", durationMs: 0,
        })
      }
      setImagesProgress(i + 1)
      setGeneratedImages([...results])
    }
    setImagesLoading(false)
  }

  async function rerunImage(pageIndex: number) {
    if (!imagePrompts?.[pageIndex] || !generatedImages) return
    const referenceImageUrls = referenceResult?.referenceImageUrls ?? []
    const referenceImageLabels = referenceResult?.referenceImageLabels ?? []
    const referenceUrl = referenceImageUrls[0] ?? referenceResult?.styledReferenceUrl ?? referenceResult?.baseReferenceUrl ?? null
    try {
      const res = await fetch("/api/workbench/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompts[pageIndex],
          referenceImageUrl: referenceUrl,
          referenceImageUrls,
          referenceImageLabels,
          imageProvider,
          pageIndex,
        }),
      })
      const data = await res.json()
      const updated = [...generatedImages]
      if (res.ok) {
        updated[pageIndex] = data as GeneratedImageResult
      } else {
        updated[pageIndex] = {
          ...updated[pageIndex],
          isErrorPlaceholder: true,
          url: "/images/story-image-error.svg",
          provider: updated[pageIndex]?.provider ?? providerCtx.label,
          model: updated[pageIndex]?.model || providerCtx.modelId,
          error: (data as { error?: string }).error ?? "Failed",
        }
      }
      setGeneratedImages(updated)
    } catch {
      // ignore
    }
  }

  async function saveStory() {
    if (saveDisabledReason) return
    if (!textResult) return
    setSaveLoading(true)
    setSaveError(null)
    const images = (generatedImages ?? []).map(r => ({
      url: r.url ?? "/images/story-image-error.svg",
      isErrorPlaceholder: r.isErrorPlaceholder,
      pageIndex: r.pageIndex,
    }))
    const generationParams = {
      kid_profile_ids: selectedProfileIds,
      kid_names: selectedProfiles.map(p => p.name),
      story_type_id: storyTypeId,
      art_style_id: artStyleId,
      story_length: storyLength,
      text_density: textDensity,
      story_description: storyDescription.trim() || undefined,
      story_type_extra_input: extraInput.trim() || undefined,
      custom_title: storyTitle.trim() || undefined,
      include_images: includeImages,
      model: textResult.model,
      image_provider: includeImages ? imageProvider : undefined,
      image_model: includeImages ? providerCtx.modelId : undefined,
      workbench: true,
    }
    try {
      const res = await fetch("/api/workbench/save-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: storyTitle || "Untitled Story",
          storyPages,
          images,
          generationParams,
          profileIds: selectedProfileIds,
          storyTypeId,
          artStyleId,
          storyLength,
          textDensity,
          includeImages,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedStoryId((data as { storyId: string }).storyId)
      } else {
        setSaveError((data as { error?: string }).error ?? "Failed to save story")
      }
    } catch {
      setSaveError("Network error. Please try again.")
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {sourceContext && <SourceContextBanner context={sourceContext} />}

      <div className="flex gap-6 items-start">

      {/* ── Left: Configuration Panel ────────────────────────────────────────── */}
      <div className="w-1/3 shrink-0 space-y-5">

        {/* 1. Profiles */}
        <div className="space-y-2">
          <SectionLabel>Profiles</SectionLabel>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles found for this account.</p>
          ) : (
            <div className="space-y-1.5">
              {profiles.map(p => (
                <label
                  key={p.id}
                  className="flex items-start gap-2 cursor-pointer rounded-lg border p-2 hover:bg-accent transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedProfileIds.includes(p.id)}
                    onChange={() => toggleProfile(p.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{formatAge(p.age, p.age_months)}</span>
                      {p.gender && <span className="text-xs text-muted-foreground">{p.gender}</span>}
                      {p.deleted_at && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          archived
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5">
                      <IllustrationStatusBadge profile={p} />
                    </div>
                  </div>
                </label>
              ))}
              {selectedIncludesArchivedProfiles && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                  Archived source profiles are selected. Deselect them before rebuilding prompts or references.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2. Story Type */}
        {storyTypes.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Story Type</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {storyTypes.map(t => (
                <SelectionCard
                  key={t.id}
                  selected={storyTypeId === t.id}
                  onClick={() => { setStoryTypeId(t.id); setExtraInput("") }}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                </SelectionCard>
              ))}
            </div>
          </div>
        )}

        {/* 3. Story Length */}
        <div className="space-y-2">
          <SectionLabel>Length</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(STORY_LENGTHS) as StoryLength[]).map(key => (
              <SelectionCard
                key={key}
                selected={storyLength === key}
                onClick={() => setStoryLength(key)}
              >
                <div className="text-sm font-medium text-center">{STORY_LENGTHS[key].label}</div>
                <div className="text-xs text-muted-foreground text-center">{STORY_LENGTHS[key].pages}p</div>
              </SelectionCard>
            ))}
          </div>
        </div>

        {/* 4. Text Density */}
        <div className="space-y-2">
          <SectionLabel>Text Density</SectionLabel>
          <div className="space-y-1.5">
            {(Object.keys(TEXT_DENSITIES) as TextDensityKey[]).map(key => (
              <SelectionCard
                key={key}
                selected={textDensity === key}
                onClick={() => setTextDensity(key)}
              >
                <div className="text-sm font-medium">{TEXT_DENSITIES[key].name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{TEXT_DENSITIES[key].description}</div>
              </SelectionCard>
            ))}
          </div>
        </div>

        {/* 5. Story Description */}
        <div className="space-y-2">
          <SectionLabel>Story Description</SectionLabel>
          <textarea
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            placeholder="Optional description or special instructions..."
            value={storyDescription}
            onChange={e => setStoryDescription(e.target.value)}
          />
        </div>

        {/* 6. Extra Input (conditional) */}
        {showExtraInput && selectedStoryType && (
          <div className="space-y-2">
            <SectionLabel>{selectedStoryType.extra_input_label ?? "Extra Input"}</SectionLabel>
            <input
              type="text"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={selectedStoryType.extra_input_hint ?? ""}
              value={extraInput}
              onChange={e => setExtraInput(e.target.value)}
            />
          </div>
        )}

        {/* 7. Art Style */}
        {artStyles.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Art Style</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {artStyles.map(s => (
                <SelectionCard
                  key={s.id}
                  selected={artStyleId === s.id}
                  onClick={() => setArtStyleId(s.id)}
                >
                  <div className="text-sm font-medium text-center">{s.name}</div>
                </SelectionCard>
              ))}
            </div>
          </div>
        )}

        {/* 8. Text Provider */}
        <div className="space-y-2">
          <SectionLabel>Text Provider</SectionLabel>
          <div className="space-y-1">
            {textProviders.map(p => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="text-provider"
                  value={p.id}
                  checked={textProvider === p.id}
                  onChange={() => setTextProvider(p.id)}
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 9. Image Provider */}
        <div className="space-y-2">
          <SectionLabel>Image Provider</SectionLabel>
          <div className="space-y-1">
            {imageProviders.map(p => {
              const disabledReason = getImageProviderDisabledReason(p, selectedProfileIds.length)
              const disabled = disabledReason !== null
              return (
              <label
                key={p.id}
                className={`flex items-start gap-2 rounded-md px-1 py-0.5 ${
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
                title={disabledReason ?? undefined}
              >
                <input
                  type="radio"
                  name="image-provider"
                  value={p.id}
                  checked={imageProvider === p.id}
                  disabled={disabled}
                  onChange={() => !disabled && setImageProvider(p.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm">{p.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatReferenceMode(p)}
                  </span>
                </span>
              </label>
            )})}
          </div>
          {selectedProfileIds.length > 0 && imageProviders.some(p => getImageProviderDisabledReason(p, selectedProfileIds.length)) && (
            <p className="text-xs text-muted-foreground">
              Some providers are unavailable for the current profile count.
            </p>
          )}
        </div>

        {/* 10. Provider Context Panel */}
        {providerCtx && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provider Info</p>
            <table className="w-full text-xs">
              <tbody>
                {(
                  [
                    ["Model", providerCtx.modelId],
                    ["Ref images", formatReferenceMode(providerCtx)],
                    ["Ref max", providerCtx.maxReferenceImages === null ? "Not stated" : String(providerCtx.maxReferenceImages)],
                    ["Seed control", providerCtx.supportsSeedControl ? "Yes" : "No"],
                    ["Content filter", providerCtx.contentFilterBehavior],
                    ["Storage", providerCtx.storageHandling],
                    ["Est. time", providerCtx.expectedTime],
                    ["Limitations", providerCtx.knownLimitations],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <tr key={label} className="border-t border-border first:border-t-0">
                    <td className="py-0.5 pr-2 text-muted-foreground font-medium w-24 align-top">{label}</td>
                    <td className="py-0.5 text-foreground">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 11. Include Images */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Include Images</span>
          <button
            type="button"
            onClick={() => setIncludeImages(v => !v)}
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

        {/* 12. Action Buttons */}
        <div className="space-y-1.5 pt-4 border-t border-border">
          <Button
            disabled={!canBuildPrompts}
            onClick={buildPrompts}
            className="w-full"
          >
            {promptsLoading ? "Building…" : "Build Prompts"}
          </Button>
          {promptsError && (
            <p className="text-xs text-destructive px-1">{promptsError}</p>
          )}
          <Button
            disabled={!canGenerateText}
            onClick={generateText}
            className="w-full"
          >
            {textLoading ? "Generating…" : "Generate Story Text"}
          </Button>
          <Button
            disabled={!canExtractVisual}
            onClick={extractVisualCtx}
            className="w-full"
          >
            {visualLoading ? "Extracting…" : "Extract Visual Context"}
          </Button>
          <Button
            disabled={!canBuildReference}
            onClick={buildReference}
            className="w-full"
          >
            {referenceLoading ? "Building…" : "Build Reference Image"}
          </Button>
          <Button
            disabled={!canGenerateImages}
            onClick={generateImages}
            className="w-full"
          >
            {imagesLoading
              ? `Generating… (${imagesProgress}/${imagePrompts?.length ?? 0})`
              : "Generate Images"}
          </Button>
          {imagesError && (
            <p className="text-xs text-destructive px-1">{imagesError}</p>
          )}
          <Button
            disabled={!canSaveStory}
            variant="outline"
            onClick={saveStory}
            className="w-full"
          >
            {saveDisabledReason ? "Save disabled" : saveLoading ? "Saving…" : "Save as Story"}
            {!saveLoading && !saveDisabledReason && (
              <span className="ml-auto text-xs text-muted-foreground">(costs credits)</span>
            )}
          </Button>
          {saveDisabledReason && (
            <p className="text-xs text-muted-foreground px-1">{saveDisabledReason}</p>
          )}
          {saveError && (
            <p className="text-xs text-destructive px-1">{saveError}</p>
          )}
          <Button variant="ghost" className="w-full" onClick={reset}>Reset</Button>
        </div>
      </div>

      {/* ── Right: Pipeline Output ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {selectedProfiles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Select profiles from the left panel to begin
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Stage 0 — Profile Inspector
            </p>

            {selectedProfiles.map(profile => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}

            {/* Stage 0 handoff */}
            <div className="rounded-lg border bg-muted/30 p-4 font-mono text-xs space-y-1">
              <p className="font-semibold mb-2">→ Passing to prompt builder:</p>
              <p>
                {"Characters: "}
                {selectedProfiles
                  .map(p => `${p.name} (${p.age}y${p.gender ? ", " + p.gender : ""})`)
                  .join(", ")}
              </p>
              <p>
                {"Toy names: "}
                {selectedProfiles
                  .map(p => p.toy?.name)
                  .filter(Boolean)
                  .join(", ") || "none"}
              </p>
              <p>
                {"Reference images: "}
                {selectedProfiles
                  .map(p => `${p.name} ${getProfileReferencePreviewUrl(p) || p.reference_image_path || p.character_illustration_path || p.combined_reference_path ? "✓" : "✗"}`)
                  .join(", ")}
              </p>
              <p>
                {"Combined reference available: "}
                {selectedProfiles.some(p => p.combined_reference_path)
                  ? "Yes"
                  : "No"}
              </p>
            </div>

            {/* Stage 1 handoff */}
            {promptsResult && (
              <div className="rounded-lg border bg-muted/30 p-4 font-mono text-xs space-y-1">
                <p className="font-semibold mb-2">→ Passing to text provider:</p>
                <p>Provider: {textProviders.find(p => p.id === textProvider)?.label ?? textProvider}</p>
                <p>System prompt: {promptsResult.tokenCounts.system.toLocaleString()} tokens</p>
                <p>User prompt: {promptsResult.tokenCounts.user.toLocaleString()} tokens</p>
                <p>
                  {"Combined: "}
                  {promptsResult.tokenCounts.combined.toLocaleString()} tokens ({promptsResult.tokenCounts.contextWindowPercent}% of context window)
                </p>
              </div>
            )}

            {/* Build prompts error */}
            {promptsError && !promptsResult && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {promptsError}
              </div>
            )}

            {/* Stage 1 card */}
            {promptsResult && <Stage1Card result={promptsResult} />}

            {/* Stage 2 streaming */}
            {textLoading && streamingText && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <span className="font-semibold text-sm">Stage 2 — Story Text</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">
                    ● streaming
                  </span>
                </div>
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground bg-muted/20 px-4 py-3">
                  {streamingText}
                </pre>
              </div>
            )}

            {/* Text error */}
            {textError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {textError}
              </div>
            )}

            {/* Stage 2 card */}
            {textResult && !textLoading && (
              <>
                <Stage2Card
                  result={textResult}
                  pages={storyPages}
                  onPagesChange={setStoryPages}
                  onRegenerate={generateText}
                />

                {/* Stage 2 handoff */}
                <div className="rounded-lg border bg-muted/30 p-4 font-mono text-xs space-y-1">
                  <p className="font-semibold mb-2">→ Passing to visual context extractor:</p>
                  <p>Pages: {storyPages.length}</p>
                  <p>Characters: {selectedProfiles.map(p => p.name).join(", ")}</p>
                  <p>
                    {"Toys: "}
                    {selectedProfiles.map(p => p.toy?.name).filter(Boolean).join(", ") || "none"}
                  </p>
                  <p>Art style: {artStyles.find(s => s.id === artStyleId)?.name ?? "not selected"}</p>
                </div>
              </>
            )}

            {/* Visual loading */}
            {visualLoading && (
              <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                Extracting visual context…
              </div>
            )}

            {/* Visual error */}
            {visualError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {visualError}
              </div>
            )}

            {/* Stage 3 card */}
            {visualResult && !visualLoading && (
              <Stage3Card result={visualResult} onRerun={extractVisualCtx} />
            )}

            {/* Reference loading */}
            {referenceLoading && (
              <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                Resolving reference images…
              </div>
            )}

            {/* Reference error */}
            {referenceError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {referenceError}
              </div>
            )}

            {/* Stage 4 card */}
            {referenceResult && !referenceLoading && (
              <>
                <Stage4Card result={referenceResult} onRerun={buildReference} />

                {/* Stage 4 handoff */}
                <div className="rounded-lg border bg-muted/30 p-4 font-mono text-xs space-y-1">
                  <p className="font-semibold mb-2">→ Passing to image generator:</p>
                  <p>
                    {"Reference images: "}
                    {referenceResult.referenceImageUrls.length}
                  </p>
                  {referenceResult.profileRefs.filter(r => r.url).map(r => (
                    <p key={r.profileId}>{r.name} ✓</p>
                  ))}
                  <p>Provider: {imageProviders.find(p => p.id === imageProvider)?.label ?? imageProvider}</p>
                  <p>
                    {"Provider supports reference images: "}
                    {providerCtx.supportsReferenceImages
                      ? "✓ Yes"
                      : "✗ No - images will use text descriptions only"}
                  </p>
                  <p>
                    {"Reference mode: "}
                    {providerCtx.referenceMode}
                  </p>
                </div>
              </>
            )}

            {/* Stage 5 card */}
            {imagePrompts && (
              <Stage5Card
                prompts={imagePrompts}
                scenes={visualResult?.visualContext.pageScenes ?? []}
                onPromptsChange={setImagePrompts}
              />
            )}

            {/* Stage 6 — images loading or partial results */}
            {(imagesLoading || generatedImages) && imagePrompts && (
              <Stage6Card
                results={generatedImages ?? []}
                pages={storyPages}
                totalImages={imagePrompts.length}
                isLoading={imagesLoading}
                progress={imagesProgress}
                onRerunPage={rerunImage}
              />
            )}

            {/* Stage 7 — save as story (shown once text is ready) */}
            {textResult && !textLoading && (
              <Stage7Card
                storyTitle={storyTitle}
                onTitleChange={setStoryTitle}
                storyLength={storyLength}
                includeImages={includeImages}
                savedStoryId={savedStoryId}
                saveLoading={saveLoading}
                saveError={saveError}
                saveDisabledReason={saveDisabledReason}
                onSave={saveStory}
              />
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

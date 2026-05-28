"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STORY_LENGTHS, type StoryLength } from "@/lib/story-lengths"
import { TEXT_DENSITIES, DEFAULT_TEXT_DENSITY, type TextDensityKey } from "@/lib/story-density"
import { listImageProviders } from "@/lib/ai/providers/image/registry"
import { listTextProviders } from "@/lib/ai/providers/text/registry"
import { formatAge } from "@/lib/ai/prompt-builder"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface KidAppearance {
  hair?: string
  hair_color?: string
  hair_style?: string
  eye_color?: string
  skin_tone?: string
  glasses?: boolean
  freckles?: boolean
  other?: string
}

interface KidToy {
  name: string
  type?: string
  color?: string
  description?: string
}

interface Profile {
  id: string
  name: string
  age: number
  age_months: number
  gender?: string | null
  appearance?: KidAppearance | null
  personality_tags?: string[] | null
  toy?: KidToy | null
  reference_image_path: string | null
  reference_image_url?: string | null
  combined_reference_path: string | null
  character_illustration_path: string | null
  illustration_status?: string | null
}

interface StoryType {
  id: string
  name: string
  description: string
  occasion_required?: boolean | null
  extra_input_label: string | null
  extra_input_hint: string | null
}

interface ArtStyle {
  id: string
  name: string
}

interface StoryGenerationTabProps {
  profiles: Profile[]
  storyTypes: StoryType[]
  artStyles: ArtStyle[]
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

// ─── Provider context ─────────────────────────────────────────────────────────

const PROVIDER_CONTEXT = {
  fal: {
    model: "FLUX Kontext / FLUX Dev",
    supportsReference: true,
    supportsSeed: true,
    contentFilterBehavior: "Silent black image on flag",
    storageHandling: "Direct URL copy",
    knownLimitations: "3+ character consistency may vary",
    expectedTime: "15–30s per image",
  },
  openai: {
    model: "gpt-image-1",
    supportsReference: true,
    supportsSeed: false,
    contentFilterBehavior: "Error response on flag",
    storageHandling: "Direct URL copy",
    knownLimitations: "No seed control — character appearance varies between pages",
    expectedTime: "10–20s per image",
  },
  gemini: {
    model: "Imagen 3",
    supportsReference: false,
    supportsSeed: false,
    contentFilterBehavior: "Error response on flag",
    storageHandling: "Base64 — must convert before storage",
    knownLimitations: "No reference image support — character anchor is text-only",
    expectedTime: "10–15s per image",
  },
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIllustrationStatus(profile: Profile): "ready" | "pending" | "missing" {
  if (profile.combined_reference_path || profile.reference_image_path) return "ready"
  if (profile.illustration_status === "pending" || profile.illustration_status === "generating") return "pending"
  return "missing"
}

function getStorageField(profile: Profile): string {
  if (profile.combined_reference_path) return "combined_reference_path"
  if (profile.character_illustration_path) return "character_illustration_path"
  if (profile.reference_image_path) return "reference_image_path"
  return "none"
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
        {profile.reference_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.reference_image_url}
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
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Stage 1 — Prompt Builder</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
          ✓ complete
        </span>
      </div>

      {/* Token summary */}
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

      {/* Story Type Contribution */}
      <div className="border-b border-border">
        <button
          type="button"
          onClick={() => setShowStoryType(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <span>Story Type Contribution</span>
          {showStoryType
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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

      {/* System Prompt */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowSystem(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors"
          >
            {showSystem
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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

      {/* User Prompt */}
      <div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowUser(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors"
          >
            {showUser
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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

// ─── Main component ───────────────────────────────────────────────────────────

export function StoryGenerationTab({ profiles, storyTypes, artStyles }: StoryGenerationTabProps) {
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([])
  const [storyTypeId, setStoryTypeId] = useState<string>(storyTypes[0]?.id ?? "")
  const [storyLength, setStoryLength] = useState<StoryLength>("medium")
  const [textDensity, setTextDensity] = useState<TextDensityKey>(DEFAULT_TEXT_DENSITY)
  const [storyDescription, setStoryDescription] = useState("")
  const [extraInput, setExtraInput] = useState("")
  const [artStyleId, setArtStyleId] = useState<string>(artStyles[0]?.id ?? "")
  const [textProvider, setTextProvider] = useState("anthropic")
  const [imageProvider, setImageProvider] = useState("fal")
  const [includeImages, setIncludeImages] = useState(true)

  const [promptsLoading, setPromptsLoading] = useState(false)
  const [promptsResult, setPromptsResult] = useState<BuildPromptsResult | null>(null)
  const [promptsError, setPromptsError] = useState<string | null>(null)

  const textProviders = listTextProviders()
  const imageProviders = listImageProviders()
  const selectedStoryType = storyTypes.find(t => t.id === storyTypeId) ?? null
  const showExtraInput = selectedStoryType
    ? (selectedStoryType.occasion_required === true || selectedStoryType.extra_input_label !== null)
    : false
  const selectedProfiles = profiles.filter(p => selectedProfileIds.includes(p.id))
  const providerCtx = PROVIDER_CONTEXT[imageProvider as keyof typeof PROVIDER_CONTEXT] ?? null
  const canBuildPrompts = selectedProfileIds.length > 0 && !!storyTypeId && !promptsLoading

  function toggleProfile(id: string) {
    setSelectedProfileIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function reset() {
    setPromptsResult(null)
    setPromptsError(null)
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

  return (
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
                    </div>
                    <div className="mt-0.5">
                      <IllustrationStatusBadge profile={p} />
                    </div>
                  </div>
                </label>
              ))}
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
            {imageProviders.map(p => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="image-provider"
                  value={p.id}
                  checked={imageProvider === p.id}
                  onChange={() => setImageProvider(p.id)}
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 10. Provider Context Panel */}
        {providerCtx && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provider Info</p>
            <table className="w-full text-xs">
              <tbody>
                {(
                  [
                    ["Model", providerCtx.model],
                    ["Ref images", providerCtx.supportsReference ? "Yes" : "No"],
                    ["Seed control", providerCtx.supportsSeed ? "Yes" : "No"],
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
          <Button disabled className="w-full">Generate Story Text</Button>
          <Button disabled className="w-full">Extract Visual Context</Button>
          <Button disabled className="w-full">Build Reference Image</Button>
          <Button disabled className="w-full">Generate Images</Button>
          <Button disabled variant="outline" className="w-full">
            Save as Story
            <span className="ml-auto text-xs text-muted-foreground">(costs credits)</span>
          </Button>
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
                  .map(p => `${p.name} ${p.reference_image_url || p.reference_image_path ? "✓" : "✗"}`)
                  .join(", ")}
              </p>
              <p>
                {"Combined reference available: "}
                {selectedProfiles.some(p => p.combined_reference_path)
                  ? "Yes — will composite at Stage 4"
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
          </div>
        )}
      </div>
    </div>
  )
}

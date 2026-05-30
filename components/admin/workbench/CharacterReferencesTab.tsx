"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildReferenceImagePrompt } from "@/lib/ai/prompt-builder"
import type { KidProfile } from "@/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileSummary {
  id: string
  name: string
  illustration_status?: string | null
}

interface HistoryRow {
  id: string
  image_url: string
  created_at: string
}

interface FullProfile {
  id: string
  name: string
  age: number
  age_months: number
  gender?: string | null
  appearance?: {
    hair?: string
    hair_color?: string
    hair_style?: string
    eye_color?: string
    skin_tone?: string
    glasses?: boolean
    freckles?: boolean
    other?: string
  } | null
  personality_tags?: string[] | null
  toy?: { name?: string; type?: string; color?: string; description?: string; backstory?: string } | null
  reference_image_url?: string | null
  character_illustration_url?: string | null
  character_illustration_path?: string | null
  toy_reference_image_url?: string | null
  toy_reference_image_path?: string | null
  combined_reference_url?: string | null
  combined_reference_path?: string | null
  illustration_status?: string | null
  history?: {
    character: HistoryRow[]
    toy: HistoryRow[]
    combined: HistoryRow[]
  }
}

interface StepResult {
  url: string | null
  prompt: string | null
  model: string
  durationMs: number
  attempts: number
  error: string | null
}

interface CharacterReferencesTabProps {
  profiles: ProfileSummary[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function illustrationStatusBadge(status: string | null | undefined): { label: string; className: string } {
  switch (status) {
    case "complete": return { label: "complete", className: "bg-green-100 text-green-700" }
    case "generating": return { label: "generating", className: "bg-blue-100 text-blue-700" }
    case "pending": return { label: "pending", className: "bg-yellow-100 text-yellow-700" }
    default: return { label: "none", className: "bg-muted text-muted-foreground" }
  }
}

function IllustrationBadge({ status }: { status?: string | null }) {
  const b = illustrationStatusBadge(status)
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${b.className}`}>
      {b.label}
    </span>
  )
}

function ImagePreview({ url, alt, path }: { url: string | null | undefined; alt: string; path: string | null | undefined }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={alt} className="w-full h-48 rounded-lg object-contain" />
    )
  }
  if (path) {
    return (
      <div className="w-full rounded-lg bg-muted border flex items-center justify-center py-6 text-xs text-muted-foreground">
        Illustration exists — regenerate to preview
      </div>
    )
  }
  return (
    <div className="w-full rounded-lg bg-muted/30 border border-dashed flex items-center justify-center py-6 text-xs text-muted-foreground">
      No illustration yet
    </div>
  )
}

function formatHistoryDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function PreviousVersions({
  current,
  rows,
  onUse,
}: {
  current: { url: string } | null
  rows: HistoryRow[]
  onUse: (url: string) => Promise<void>
}) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<{ id: string; message: string } | null>(null)

  if (!current && rows.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Previous versions</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {current && (
          <div className="flex-none flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt="Current version" className="w-16 h-16 rounded object-cover border" />
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
              Current
            </span>
          </div>
        )}
        {rows.map(row => (
          <div key={row.id} className="flex-none flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.image_url} alt="Previous version" className="w-16 h-16 rounded object-cover border" />
            <span className="text-[10px] text-muted-foreground">{formatHistoryDate(row.created_at)}</span>
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] px-1.5 h-5"
              disabled={savingId === row.id}
              onClick={async () => {
                setSavingId(row.id)
                setSaveError(null)
                try {
                  await onUse(row.image_url)
                } catch (e) {
                  setSaveError({ id: row.id, message: e instanceof Error ? e.message : "Failed" })
                } finally {
                  setSavingId(null)
                }
              }}
            >
              {savingId === row.id ? "Saving…" : "Use this version"}
            </Button>
            {saveError?.id === row.id && (
              <span className="text-[10px] text-destructive">{saveError.message}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step card wrapper ────────────────────────────────────────────────────────

function StepCard({
  stepLabel,
  children,
}: {
  stepLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-sm font-semibold">{stepLabel}</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        {children}
      </div>
    </div>
  )
}

// ─── Result panel ─────────────────────────────────────────────────────────────

function StepResultPanel({ result }: { result: StepResult }) {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
          result.url ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {result.url ? "✓ generated" : "✗ failed"}
        </span>
        <span className="text-muted-foreground">{result.model}</span>
        <span className="text-muted-foreground">{(result.durationMs / 1000).toFixed(1)}s</span>
      </div>
      {result.error && (
        <p className="text-xs text-destructive">{result.error}</p>
      )}
      {result.prompt && (
        <>
          <button
            type="button"
            onClick={() => setShowPrompt(v => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Prompt used
          </button>
          {showPrompt && (
            <pre className="whitespace-pre-wrap break-words px-3 py-2 bg-muted/40 rounded-lg font-mono text-[11px] leading-relaxed text-foreground">
              {result.prompt}
            </pre>
          )}
        </>
      )}
      {result.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.url} alt="Generated result" className="w-full h-48 rounded-lg object-contain" />
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CharacterReferencesTab({ profiles }: CharacterReferencesTabProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("")
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Step R1
  const [charLoading, setCharLoading] = useState(false)
  const [charResult, setCharResult] = useState<StepResult | null>(null)
  const [saveCharLoading, setSaveCharLoading] = useState(false)

  // Step R2
  const [toyLoading, setToyLoading] = useState(false)
  const [toyResult, setToyResult] = useState<StepResult | null>(null)
  const [saveToyLoading, setSaveToyLoading] = useState(false)

  // Step R3
  const [combinedLoading, setCombinedLoading] = useState(false)
  const [combinedResult, setCombinedResult] = useState<StepResult | null>(null)
  const [saveCombinedLoading, setSaveCombinedLoading] = useState(false)

  // Save all
  const [saveAllLoading, setSaveAllLoading] = useState(false)
  const [savedFields, setSavedFields] = useState<string[]>([])

  async function selectProfile(id: string) {
    setSelectedProfileId(id)
    setFullProfile(null)
    setCharResult(null)
    setToyResult(null)
    setCombinedResult(null)
    setSavedFields([])
    if (!id) return
    setProfileLoading(true)
    try {
      const res = await fetch("/api/workbench/profile-illustrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: id }),
      })
      if (res.ok) setFullProfile(await res.json() as FullProfile)
    } catch {
      // ignore
    } finally {
      setProfileLoading(false)
    }
  }

  async function runStep(step: "character" | "toy" | "combined") {
    if (!selectedProfileId) return
    const setLoading = step === "character" ? setCharLoading : step === "toy" ? setToyLoading : setCombinedLoading
    const setResult = step === "character" ? setCharResult : step === "toy" ? setToyResult : setCombinedResult
    const savedFieldKey = step === "character" ? "character_illustration_path"
      : step === "toy" ? "toy_reference_image_path"
      : "combined_reference_path"
    setLoading(true)
    setResult(null)
    setSavedFields(prev => prev.filter(f => f !== savedFieldKey))
    try {
      const res = await fetch("/api/workbench/generate-reference-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          profileId: selectedProfileId,
          ...(step === "combined" && {
            characterUrl: charResult?.url ?? undefined,
            toyUrl: toyResult?.url ?? undefined,
          }),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data as StepResult)
      } else {
        setResult({ url: null, prompt: null, model: "", durationMs: 0, attempts: 0, error: (data as { error?: string }).error ?? "Failed" })
      }
    } catch {
      setResult({ url: null, prompt: null, model: "", durationMs: 0, attempts: 0, error: "Network error" })
    } finally {
      setLoading(false)
    }
  }

  async function saveImages(opts: { characterUrl?: string; toyUrl?: string; combinedUrl?: string }): Promise<boolean> {
    if (!selectedProfileId) return false
    const res = await fetch("/api/workbench/save-reference-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: selectedProfileId, ...opts }),
    })
    if (!res.ok) return false
    const data = await res.json() as { updated: string[] }
    setSavedFields(prev => [...new Set([...prev, ...data.updated])])
    // Reload to get updated signed URLs and history
    const profileRes = await fetch("/api/workbench/profile-illustrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: selectedProfileId }),
    })
    if (profileRes.ok) setFullProfile(await profileRes.json() as FullProfile)
    return true
  }

  async function saveCharacter() {
    if (!charResult?.url) return
    setSaveCharLoading(true)
    await saveImages({ characterUrl: charResult.url })
    setCharResult(null)
    setSaveCharLoading(false)
  }

  async function saveToy() {
    if (!toyResult?.url) return
    setSaveToyLoading(true)
    await saveImages({ toyUrl: toyResult.url })
    setToyResult(null)
    setSaveToyLoading(false)
  }

  async function saveCombined() {
    if (!combinedResult?.url) return
    setSaveCombinedLoading(true)
    await saveImages({ combinedUrl: combinedResult.url })
    setCombinedResult(null)
    setSaveCombinedLoading(false)
  }

  async function saveAll() {
    setSaveAllLoading(true)
    await saveImages({
      characterUrl: charResult?.url ?? undefined,
      toyUrl: toyResult?.url ?? undefined,
      combinedUrl: combinedResult?.url ?? undefined,
    })
    setCharResult(null)
    setToyResult(null)
    setCombinedResult(null)
    setSaveAllLoading(false)
  }

  async function saveHistoryVersion(step: "character" | "toy" | "combined", url: string): Promise<void> {
    const opts = step === "character" ? { characterUrl: url }
      : step === "toy" ? { toyUrl: url }
      : { combinedUrl: url }
    const ok = await saveImages(opts)
    if (!ok) throw new Error("Save failed")
  }

  const hasToy = !!(fullProfile?.toy?.name)
  const canSaveAll = !!(charResult?.url || toyResult?.url || combinedResult?.url)
  const charPromptPreview = fullProfile
    ? buildReferenceImagePrompt(fullProfile as unknown as KidProfile)
    : null
  const currentCharUrl = fullProfile?.character_illustration_url ?? fullProfile?.reference_image_url ?? null
  const currentToyUrl = fullProfile?.toy_reference_image_url ?? null
  const currentCombinedUrl = fullProfile?.combined_reference_url ?? null

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile selector */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Profile</p>
        <select
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={selectedProfileId}
          onChange={e => selectProfile(e.target.value)}
        >
          <option value="">— select a profile —</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({illustrationStatusBadge(p.illustration_status).label})
            </option>
          ))}
        </select>
      </div>

      {profileLoading && (
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      )}

      {fullProfile && !profileLoading && (
        <div className="space-y-6">
          {/* Profile summary */}
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{fullProfile.name}</span>
              <IllustrationBadge status={fullProfile.illustration_status} />
            </div>
            {fullProfile.gender && <p>Gender: {fullProfile.gender}</p>}
            {fullProfile.appearance?.skin_tone && <p>Skin: {fullProfile.appearance.skin_tone}</p>}
            {(fullProfile.appearance?.hair || fullProfile.appearance?.hair_color) && (
              <p>Hair: {fullProfile.appearance?.hair ?? fullProfile.appearance?.hair_color}</p>
            )}
            {fullProfile.appearance?.eye_color && <p>Eyes: {fullProfile.appearance.eye_color}</p>}
            {(fullProfile.personality_tags?.length ?? 0) > 0 && (
              <p>Personality: {fullProfile.personality_tags!.join(", ")}</p>
            )}
            {fullProfile.toy?.name && (
              <p>Toy: {fullProfile.toy.name}{fullProfile.toy.description ? ` — ${fullProfile.toy.description}` : ""}</p>
            )}
          </div>

          {/* Step R1 — Character Illustration */}
          <StepCard stepLabel="Step R1 — Character Illustration">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Current illustration</p>
              <ImagePreview
                url={fullProfile.character_illustration_url ?? fullProfile.reference_image_url}
                alt={`${fullProfile.name} character illustration`}
                path={fullProfile.character_illustration_path}
              />
            </div>

            <PreviousVersions
              current={currentCharUrl ? { url: currentCharUrl } : null}
              rows={fullProfile.history?.character ?? []}
              onUse={(url) => saveHistoryVersion("character", url)}
            />

            {charPromptPreview && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Prompt to be sent</p>
                <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 bg-muted/40 rounded-lg font-mono text-[11px] leading-relaxed text-foreground">
                  {charPromptPreview}
                </pre>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={charLoading}
                onClick={() => runStep("character")}
                className="flex-1"
              >
                {charLoading ? "Generating…" : "Generate character illustration"}
              </Button>
              {charResult?.url && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveCharLoading}
                  onClick={saveCharacter}
                >
                  {saveCharLoading ? "Saving…" : savedFields.includes("character_illustration_path") ? "✓ Saved" : "Save to profile"}
                </Button>
              )}
            </div>

            {charResult && <StepResultPanel result={charResult} />}
          </StepCard>

          {/* Step R2 — Toy Illustration */}
          <StepCard stepLabel="Step R2 — Toy Illustration">
            {!hasToy && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                No toy name set on this profile. Add a toy in the profile settings before generating.
              </p>
            )}

            {hasToy && (
              <div className="text-xs space-y-0.5">
                <p className="font-medium">{fullProfile.toy!.name}</p>
                {fullProfile.toy?.description && (
                  <p className="text-muted-foreground">{fullProfile.toy.description}</p>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Current toy illustration</p>
              <ImagePreview
                url={fullProfile.toy_reference_image_url}
                alt={`${fullProfile.name} toy illustration`}
                path={fullProfile.toy_reference_image_path}
              />
            </div>

            <PreviousVersions
              current={currentToyUrl ? { url: currentToyUrl } : null}
              rows={fullProfile.history?.toy ?? []}
              onUse={(url) => saveHistoryVersion("toy", url)}
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!hasToy || toyLoading}
                onClick={() => runStep("toy")}
                className="flex-1"
              >
                {toyLoading ? "Generating…" : "Generate toy illustration"}
              </Button>
              {toyResult?.url && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveToyLoading}
                  onClick={saveToy}
                >
                  {saveToyLoading ? "Saving…" : savedFields.includes("toy_reference_image_path") ? "✓ Saved" : "Save to profile"}
                </Button>
              )}
            </div>

            {toyResult && <StepResultPanel result={toyResult} />}
          </StepCard>

          {/* Step R3 — Combined Reference */}
          <StepCard stepLabel="Step R3 — Combined Reference">
            {!fullProfile.character_illustration_path && !charResult?.url && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                Character illustration required. Complete Step R1 and save it before generating combined.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Character input</p>
                <ImagePreview
                  url={charResult?.url ?? fullProfile.character_illustration_url}
                  alt="Character illustration"
                  path={fullProfile.character_illustration_path}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Toy input</p>
                <ImagePreview
                  url={toyResult?.url ?? fullProfile.toy_reference_image_url}
                  alt="Toy illustration"
                  path={fullProfile.toy_reference_image_path}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Current combined reference</p>
              <ImagePreview
                url={fullProfile.combined_reference_url}
                alt={`${fullProfile.name} combined reference`}
                path={fullProfile.combined_reference_path}
              />
            </div>

            <PreviousVersions
              current={currentCombinedUrl ? { url: currentCombinedUrl } : null}
              rows={fullProfile.history?.combined ?? []}
              onUse={(url) => saveHistoryVersion("combined", url)}
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={combinedLoading || (!fullProfile.character_illustration_path && !charResult?.url)}
                onClick={() => runStep("combined")}
                className="flex-1"
              >
                {combinedLoading ? "Generating…" : "Generate combined reference"}
              </Button>
              {combinedResult?.url && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveCombinedLoading}
                  onClick={saveCombined}
                >
                  {saveCombinedLoading ? "Saving…" : savedFields.includes("combined_reference_path") ? "✓ Saved" : "Save to profile"}
                </Button>
              )}
            </div>

            {combinedResult && <StepResultPanel result={combinedResult} />}
          </StepCard>

          {/* Save all */}
          {canSaveAll && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                disabled={saveAllLoading}
                onClick={saveAll}
                className="w-full"
              >
                {saveAllLoading ? "Saving all…" : "Save all generated images to profile"}
              </Button>
              {savedFields.length > 0 && (
                <p className="text-xs text-green-700 mt-2">
                  Saved: {savedFields.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProfile, updateProfile } from "@/app/actions/profiles"
import type { CreateProfileResult } from "@/app/actions/profiles"
import { ChevronDown, History, Info, Loader2, RefreshCw, UserCircle, Wand2 } from "lucide-react"

// ─── Shared types ──────────────────────────────────────────────────────────────

interface HistoryRow {
  id: string
  image_type: string
  image_url: string
  created_at: string
  profile_snapshot: Record<string, unknown> | null
  is_active: boolean
  activation_count: number
  last_activated_at: string | null
}

interface EditProfile {
  id: string
  name: string
  age: number
  age_months: number
  gender?: string
  appearance: { hair?: string; hair_color?: string; eye_color?: string; skin_tone?: string }
  personality_tags: string[]
  toy: { name: string; description?: string; type?: string; generic_description?: string | null }
  reference_image_url?: string | null
  character_illustration_url?: string | null
  combined_reference_url?: string | null
  toy_reference_image_url?: string | null
  illustration_status?: string | null
  character_history?: HistoryRow[]
  toy_history?: HistoryRow[]
}

interface ProfileFormProps {
  onSuccess?: () => void
  onCreated?: (profileId: string, characterName: string) => void
  profile?: EditProfile
  waitForIllustration?: boolean
  profileId?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatHistoryDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

function snapshotSummary(snapshot: Record<string, unknown> | null): string | null {
  if (!snapshot) return null
  const appearance = (snapshot.appearance ?? {}) as Record<string, unknown>
  const parts: string[] = []
  if (typeof appearance.hair === "string" && appearance.hair) parts.push(appearance.hair)
  else if (typeof appearance.hair_color === "string" && appearance.hair_color) parts.push(appearance.hair_color)
  if (typeof appearance.eye_color === "string" && appearance.eye_color) parts.push(`${appearance.eye_color} eyes`)
  return parts.length > 0 ? parts.join(", ") : null
}

// ─── IllustrationBlock ─────────────────────────────────────────────────────────

interface IllustrationBlockProps {
  type: "character" | "toy"
  profileId: string
  profileName: string
  imageUrl: string | null
  initialHistory: HistoryRow[]
  hasFieldsChanged: () => boolean
  onRegenSuccess: (url: string) => void
  onRestoreSuccess: (url: string, snapshot: Record<string, unknown> | null) => void
}

function IllustrationBlock({
  type,
  profileId,
  profileName,
  imageUrl,
  initialHistory,
  hasFieldsChanged,
  onRegenSuccess,
  onRestoreSuccess,
}: IllustrationBlockProps) {
  const [history, setHistory] = useState<HistoryRow[]>(initialHistory)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedRestoreId, setSelectedRestoreId] = useState<string | null>(null)
  const [regenState, setRegenState] = useState<"idle" | "confirming" | "loading">("idle")
  const [regenFieldsWarning, setRegenFieldsWarning] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const mostRecentEntry = history[0] ?? null
  const selectedEntry = selectedRestoreId ? history.find(h => h.id === selectedRestoreId) ?? null : null

  async function doRegen() {
    setRegenState("loading")
    setRegenError(null)
    try {
      const res = await fetch("/api/profiles/regenerate-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, step: type }),
      })
      const data = await res.json() as { url?: string; path?: string; error?: string }
      if (!res.ok || !data.url) {
        setRegenError(data.error ?? "Regeneration failed")
      } else {
        const newRow: HistoryRow = {
          id: `temp-${Date.now()}`,
          image_type: type,
          image_url: data.url,
          created_at: new Date().toISOString(),
          profile_snapshot: null,
          is_active: true,
          activation_count: 0,
          last_activated_at: null,
        }
        setHistory(prev => [newRow, ...prev.map(h => ({ ...h, is_active: false })).slice(0, 4)])
        setSelectedRestoreId(null)
        onRegenSuccess(data.url)
      }
    } catch {
      setRegenError("Request failed")
    } finally {
      setRegenState("idle")
    }
  }

  function handleRegenClick() {
    if (regenState === "loading") return
    const changed = hasFieldsChanged()

    if (!changed && regenState === "idle") {
      setRegenState("confirming")
      setRegenFieldsWarning(false)
      return
    }

    if (regenState === "confirming") {
      doRegen()
      return
    }

    if (changed) {
      setRegenFieldsWarning(true)
      doRegen()
    }
  }

  async function handleRestore() {
    if (!selectedEntry || restoring) return
    setRestoring(true)
    setRestoreError(null)
    try {
      const res = await fetch("/api/profiles/restore-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, historyId: selectedEntry.id }),
      })
      const data = await res.json() as { path?: string; profileSnapshot?: Record<string, unknown> | null; error?: string }
      if (!res.ok || !data.path) {
        setRestoreError(data.error ?? "Restore failed")
      } else {
        setHistory(prev => prev.map(h => ({ ...h, is_active: h.id === selectedEntry.id })))
        setSelectedRestoreId(null)
        onRestoreSuccess(selectedEntry.image_url, data.profileSnapshot ?? null)
      }
    } catch {
      setRestoreError("Request failed")
    } finally {
      setRestoring(false)
    }
  }

  const sectionLabel = type === "character" ? "CHARACTER ILLUSTRATION" : "COMPANION ILLUSTRATION"

  return (
    <div className="space-y-2">
      {/* Section header row */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-medium" style={{ color: "#a78bfa" }}>{sectionLabel}</p>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => { setHistoryOpen(v => !v); setSelectedRestoreId(null) }}
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${imageUrl ? "bg-green-500" : "bg-gray-400"}`} />
        <span className="text-xs text-muted-foreground">{imageUrl ? "Up to date" : "Not generated"}</span>
      </div>

      {/* Image block */}
      <div
        className="w-full overflow-hidden rounded-lg border border-border bg-[#fffbf5]"
        style={{ aspectRatio: "16/7" }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={profileName} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground bg-muted/20">
            <UserCircle className="w-8 h-8" />
            <p className="text-xs">No illustration yet</p>
          </div>
        )}
      </div>

      {/* History strip */}
      {historyOpen && (
        <div className="mt-1 space-y-2">
          <div
            className="flex gap-2 pb-1 overflow-x-auto"
            style={{ scrollbarWidth: "none" } as React.CSSProperties}
          >
            {history.map(h => (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelectedRestoreId(prev => prev === h.id ? null : h.id)}
                className={`shrink-0 w-[46px] h-[46px] rounded overflow-hidden border-2 transition-all ${
                  h.is_active ? "border-purple-600" : "border-transparent hover:border-muted-foreground/40"
                } ${selectedRestoreId === h.id && !h.is_active ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.image_url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Restore card */}
          {selectedEntry && !selectedEntry.is_active && (
            <div className="rounded-lg border border-border p-3 space-y-2 bg-card/50">
              <div className="flex gap-3">
                <div className="shrink-0 w-[46px] h-[46px] rounded overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedEntry.image_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium">Version from {formatHistoryDate(selectedEntry.created_at)}</p>
                  {snapshotSummary(selectedEntry.profile_snapshot) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {snapshotSummary(selectedEntry.profile_snapshot)}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Restoring won&apos;t cost a wish or add to your history.
                  </p>
                </div>
              </div>
              {restoreError && <p className="text-xs text-destructive">{restoreError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedRestoreId(null); setRestoreError(null) }}
                  className="flex-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={restoring}
                  className="flex-1 text-xs font-medium rounded px-2 py-1 transition-opacity disabled:opacity-50"
                  style={{ background: "#7c3aed", color: "white" }}
                >
                  {restoring ? "Restoring…" : "Restore this version"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-muted-foreground">
          {mostRecentEntry
            ? `Last generated ${formatHistoryDate(mostRecentEntry.created_at)}`
            : "Never generated"}
        </p>
        <button
          type="button"
          onClick={handleRegenClick}
          disabled={regenState === "loading"}
          className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md border border-border hover:bg-muted/40 transition-colors disabled:opacity-50"
        >
          {regenState === "loading"
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Wand2 className="w-3 h-3" />}
          Regenerate
          <span
            className="ml-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(120,53,15,0.4)", color: "#fbbf24" }}
          >
            1 ✨
          </span>
        </button>
      </div>

      {/* Unsaved changes warning */}
      {regenFieldsWarning && regenState !== "confirming" && (
        <p className="text-[11px] text-amber-500">Save your changes first for best results.</p>
      )}

      {/* No-changes confirm banner */}
      {regenState === "confirming" && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 p-3 space-y-2">
          <p className="text-[12px] text-amber-300">
            No changes since last generation. Regenerating will use the same description and cost 1 wish.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRegenState("idle")}
              className="flex-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doRegen}
              className="flex-1 text-xs font-medium rounded px-2 py-1"
              style={{ background: "#7c3aed", color: "white" }}
            >
              Regenerate anyway — 1 ✨
            </button>
          </div>
        </div>
      )}

      {/* Regen error */}
      {regenError && <p className="text-xs text-destructive">{regenError}</p>}
    </div>
  )
}

// ─── ProfileForm ───────────────────────────────────────────────────────────────

export function ProfileForm({ onSuccess, onCreated, profile, waitForIllustration, profileId }: ProfileFormProps) {
  const action = profile ? updateProfile.bind(null, profile.id) : createProfile
  const submittedRef = useRef(false)
  const submittedNameRef = useRef<string>("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [actionState, formAction, pending] = useActionState(action as any, null as CreateProfileResult | string | null)
  const [waitingForIllustration, setWaitingForIllustration] = useState(false)

  // Derive a plain error string from the polymorphic action state
  const errorMsg = actionState === null ? null
    : typeof actionState === "string" ? actionState
    : "error" in actionState ? (actionState.error ?? null)
    : null

  useEffect(() => {
    if (!submittedRef.current || pending) return
    submittedRef.current = false

    // Create-mode success: action returned { profileId }
    if (!profile && actionState && typeof actionState === "object" && "profileId" in actionState && actionState.profileId) {
      onCreated?.(actionState.profileId, submittedNameRef.current)
      return
    }

    // Any error: stop here
    if (errorMsg !== null) return

    if (waitForIllustration && profileId) {
      const start = Date.now()
      const TIMEOUT_MS = 90_000

      const poll = async () => {
        if (Date.now() - start > TIMEOUT_MS) {
          setWaitingForIllustration(false)
          onSuccess?.()
          return
        }
        try {
          const res = await fetch(`/api/profiles/${profileId}/illustration-status`)
          if (res.ok) {
            const json = await res.json() as { illustration_status: string | null }
            const status = json.illustration_status
            if (status === "complete" || status === "failed" || status === "none") {
              setWaitingForIllustration(false)
              onSuccess?.()
              return
            }
          }
        } catch {
          // network error — keep polling
        }
        setTimeout(poll, 2000)
      }

      // Defer into a callback so setState is not called synchronously inside the effect
      setTimeout(() => { setWaitingForIllustration(true); void poll() }, 0)
      return
    }

    onSuccess?.()
  }, [actionState, errorMsg, onCreated, onSuccess, pending, waitForIllustration, profileId, profile])

  // ── Edit-mode initial values (safe to compute even in create mode) ──
  const initialToyName = profile?.toy?.name === "their favorite toy" ? "" : (profile?.toy?.name ?? "")
  const initialToyDesc = profile?.toy?.description ?? profile?.toy?.type ?? ""
  const initialHair = profile?.appearance?.hair ?? profile?.appearance?.hair_color ?? ""
  const initialPersonality = profile?.personality_tags?.[0] ?? ""

  // ── All hooks called unconditionally (must precede any early return) ──
  const [fieldValues, setFieldValues] = useState({
    name: profile?.name ?? "",
    age: String(profile?.age ?? ""),
    age_months: String(profile?.age_months ?? ""),
    gender: profile?.gender ?? "",
    eye_color: profile?.appearance?.eye_color ?? "",
    skin_tone: profile?.appearance?.skin_tone ?? "",
    hair: initialHair,
    personality_tags: initialPersonality,
    toy_name: initialToyName,
    toy_description: initialToyDesc,
  })

  const originalRef = useRef({
    name: profile?.name ?? "",
    gender: profile?.gender ?? "",
    eye_color: profile?.appearance?.eye_color ?? "",
    skin_tone: profile?.appearance?.skin_tone ?? "",
    hair: initialHair,
    personality_tags: initialPersonality,
    toy_name: initialToyName,
    toy_description: initialToyDesc,
  })

  const [charUrl, setCharUrl] = useState<string | null>(profile?.combined_reference_url ?? profile?.character_illustration_url ?? profile?.reference_image_url ?? null)
  const [toyUrl, setToyUrl] = useState<string | null>(profile?.toy_reference_image_url ?? null)
  const [charHistory] = useState<HistoryRow[]>(profile?.character_history ?? [])
  const [toyHistory] = useState<HistoryRow[]>(profile?.toy_history ?? [])

  const [charRestorePrompt, setCharRestorePrompt] = useState<Record<string, unknown> | null>(null)
  const [charFieldsRestored, setCharFieldsRestored] = useState(false)
  const [toyRestorePrompt, setToyRestorePrompt] = useState<Record<string, unknown> | null>(null)
  const [toyFieldsRestored, setToyFieldsRestored] = useState(false)
  const [showToyTip, setShowToyTip] = useState(false)
  const [genericDesc] = useState<string | null>(
    profile?.toy?.generic_description ?? null
  )
  const [showGenericDesc, setShowGenericDesc] = useState(false)

  // ── Create mode: early return (after all hooks) ──
  if (!profile) {
    return (
      <form action={formAction} onSubmit={(e) => {
        submittedRef.current = true
        const fd = new FormData(e.currentTarget)
        submittedNameRef.current = String(fd.get("name") ?? "").trim()
      }} className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 space-y-1.5">
            <Label htmlFor="name">Child&apos;s name</Label>
            <Input id="name" name="name" placeholder="Emma" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age">Years</Label>
            <Input id="age" name="age" type="number" min="0" max="17" placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age_months">Months</Label>
            <Input id="age_months" name="age_months" type="number" min="0" max="11" placeholder="0" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <select
              id="gender"
              name="gender"
              defaultValue=""
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Not specified</option>
              <option value="girl">Girl</option>
              <option value="boy">Boy</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eye_color">Eye color</Label>
            <Input id="eye_color" name="eye_color" placeholder="blue" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="skin_tone">Skin tone</Label>
            <Input id="skin_tone" name="skin_tone" placeholder="light, medium brown, dark, olive…" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hair">Hair</Label>
          <Input id="hair" name="hair" placeholder="long curly brown hair" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="personality_tags">Personality</Label>
          <Input id="personality_tags" name="personality_tags" placeholder="curious and adventurous, loves dinosaurs and building things" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase font-medium" style={{ color: "#a78bfa" }}>Companion</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowToyTip(v => !v)}
              onBlur={() => setTimeout(() => setShowToyTip(false), 150)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-muted-foreground border border-border hover:bg-muted/50 transition-colors"
              aria-label="Tips for toy descriptions"
            >
              <Info className="w-3 h-3" />
              Tips for toy names
            </button>
            {showToyTip && (
              <div
                className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-lg border border-border bg-card p-3 text-[12px] text-muted-foreground leading-relaxed shadow-sm"
                role="tooltip"
              >
                <p className="font-medium text-foreground mb-1">Describe toys in your own words</p>
                Use descriptive language rather than brand names — for example, &ldquo;a small yellow sponge character&rdquo; instead of a branded name. This helps Luma illustrate your toy accurately in every story.
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="toy_name">Favorite toy name</Label>
            <Input id="toy_name" name="toy_name" placeholder="Teddy" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="toy_description">Toy description</Label>
            <Input id="toy_description" name="toy_description" placeholder="a worn brown stuffed bear" />
          </div>
        </div>
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving..." : "Add Profile"}
        </Button>
      </form>
    )
  }

  // ── Edit mode helpers ─────────────────────────────────────────────────────────

  function setField(key: keyof typeof fieldValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFieldValues(v => ({ ...v, [key]: e.target.value }))
  }

  function hasCharFieldsChanged(): boolean {
    const orig = originalRef.current
    return (
      fieldValues.name !== orig.name ||
      fieldValues.gender !== orig.gender ||
      fieldValues.eye_color !== orig.eye_color ||
      fieldValues.skin_tone !== orig.skin_tone ||
      fieldValues.hair !== orig.hair ||
      fieldValues.personality_tags !== orig.personality_tags
    )
  }

  function hasToyFieldsChanged(): boolean {
    const orig = originalRef.current
    return fieldValues.toy_name !== orig.toy_name || fieldValues.toy_description !== orig.toy_description
  }

  function applyCharSnapshot(snapshot: Record<string, unknown>) {
    const appearance = (snapshot.appearance ?? {}) as Record<string, unknown>
    const tags = Array.isArray(snapshot.personality_tags) ? snapshot.personality_tags as string[] : []
    setFieldValues(v => ({
      ...v,
      name: typeof snapshot.name === "string" ? snapshot.name : v.name,
      gender: typeof snapshot.gender === "string" ? snapshot.gender : v.gender,
      eye_color: typeof appearance.eye_color === "string" ? appearance.eye_color : v.eye_color,
      skin_tone: typeof appearance.skin_tone === "string" ? appearance.skin_tone : v.skin_tone,
      hair: typeof appearance.hair === "string" ? appearance.hair
        : typeof appearance.hair_color === "string" ? appearance.hair_color
        : v.hair,
      personality_tags: tags.length > 0 ? tags[0] : v.personality_tags,
    }))
    setCharFieldsRestored(true)
  }

  function applyToySnapshot(snapshot: Record<string, unknown>) {
    const toy = (snapshot.toy ?? {}) as Record<string, unknown>
    setFieldValues(v => ({
      ...v,
      toy_name: typeof toy.name === "string" ? toy.name : v.toy_name,
      toy_description: typeof toy.description === "string" ? toy.description
        : typeof toy.type === "string" ? toy.type
        : v.toy_description,
    }))
    setToyFieldsRestored(true)
  }

  const isGenerating = profile.illustration_status === "generating"
  const hasToyName = fieldValues.toy_name.trim().length > 0

  // ── Edit mode render ──────────────────────────────────────────────────────────

  return (
    <form action={formAction} onSubmit={() => { submittedRef.current = true }} className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 shrink-0">
          <div
            className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-lg font-bold ring-2 ring-purple-500"
            style={{ background: "#1a0533", color: "#e9d5ff" }}
          >
            {charUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={charUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              getInitials(fieldValues.name || profile.name)
            )}
          </div>
          {isGenerating && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: "#78350f", border: "1.5px solid #1a0533" }}
            >
              <RefreshCw className="w-2.5 h-2.5 text-amber-400" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium truncate">{fieldValues.name || profile.name}</p>
          <p className="text-[13px] text-muted-foreground truncate">
            {fieldValues.age ? `${fieldValues.age}y` : ""}
            {fieldValues.age_months ? ` ${fieldValues.age_months}m` : ""}
            {fieldValues.gender ? ` · ${fieldValues.gender}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Profile picture updates automatically — no wish needed.
          </p>
        </div>
      </div>

      {/* ── CHARACTER DETAILS ── */}
      <p className="text-[10px] uppercase font-medium" style={{ color: "#a78bfa" }}>Character Details</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-1.5">
          <Label htmlFor="name">Child&apos;s name</Label>
          <Input id="name" name="name" placeholder="Emma" required value={fieldValues.name} onChange={setField("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="age">Years</Label>
          <Input id="age" name="age" type="number" min="0" max="17" placeholder="0" value={fieldValues.age} onChange={setField("age")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="age_months">Months</Label>
          <Input id="age_months" name="age_months" type="number" min="0" max="11" placeholder="0" value={fieldValues.age_months} onChange={setField("age_months")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            name="gender"
            value={fieldValues.gender}
            onChange={setField("gender")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Not specified</option>
            <option value="girl">Girl</option>
            <option value="boy">Boy</option>
            <option value="non-binary">Non-binary</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eye_color">Eye color</Label>
          <Input id="eye_color" name="eye_color" placeholder="blue" value={fieldValues.eye_color} onChange={setField("eye_color")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="skin_tone">Skin tone</Label>
          <Input id="skin_tone" name="skin_tone" placeholder="light, medium brown, dark, olive…" value={fieldValues.skin_tone} onChange={setField("skin_tone")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hair">Hair</Label>
        <Input id="hair" name="hair" placeholder="long curly brown hair" value={fieldValues.hair} onChange={setField("hair")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="personality_tags">Personality</Label>
        <Input
          id="personality_tags"
          name="personality_tags"
          placeholder="curious and adventurous, loves dinosaurs and building things"
          value={fieldValues.personality_tags}
          onChange={setField("personality_tags")}
        />
      </div>

      {/* ── Divider ── */}
      <hr className="border-t border-border" />

      {/* ── CHARACTER ILLUSTRATION ── */}
      <IllustrationBlock
        type="character"
        profileId={profile.id}
        profileName={profile.name}
        imageUrl={charUrl}
        initialHistory={charHistory}
        hasFieldsChanged={hasCharFieldsChanged}
        onRegenSuccess={url => setCharUrl(url)}
        onRestoreSuccess={(url, snapshot) => {
          setCharUrl(url)
          if (snapshot && Object.keys(snapshot).length > 0) {
            setCharRestorePrompt(snapshot)
            setCharFieldsRestored(false)
          }
        }}
      />

      {/* Restore-fields prompt (character) */}
      {charRestorePrompt && !charFieldsRestored && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-card/50">
          <p className="text-[12px] text-muted-foreground">Want to restore the original description too?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCharRestorePrompt(null)}
              className="flex-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
            >
              Keep current
            </button>
            <button
              type="button"
              onClick={() => { applyCharSnapshot(charRestorePrompt); setCharRestorePrompt(null) }}
              className="flex-1 text-xs font-medium rounded px-2 py-1"
              style={{ background: "#7c3aed", color: "white" }}
            >
              Yes, restore fields
            </button>
          </div>
        </div>
      )}
      {charFieldsRestored && (
        <p className="text-[11px] text-amber-400">Fields updated — save to keep these changes.</p>
      )}

      {/* ── Divider ── */}
      <hr className="border-t border-border" />

      {/* ── COMPANION ── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-medium" style={{ color: "#a78bfa" }}>Companion</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowToyTip(v => !v)}
            onBlur={() => setTimeout(() => setShowToyTip(false), 150)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-muted-foreground border border-border hover:bg-muted/50 transition-colors"
            aria-label="Tips for toy descriptions"
          >
            <Info className="w-3 h-3" />
            Tips for toy names
          </button>
          {showToyTip && (
            <div
              className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-lg border border-border bg-card p-3 text-[12px] text-muted-foreground leading-relaxed shadow-sm"
              role="tooltip"
            >
              <p className="font-medium text-foreground mb-1">Describe toys in your own words</p>
              Use descriptive language rather than brand names — for example, &ldquo;a small yellow sponge character&rdquo; instead of a branded name. This helps Luma illustrate your toy accurately in every story.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="toy_name">Favorite toy name</Label>
          <Input id="toy_name" name="toy_name" placeholder="Teddy" value={fieldValues.toy_name} onChange={setField("toy_name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toy_description">Toy description</Label>
          <Input id="toy_description" name="toy_description" placeholder="a worn brown stuffed bear" value={fieldValues.toy_description} onChange={setField("toy_description")} />
        </div>
      </div>

      {/* Luma generic description disclosure */}
      <div>
        <button
          type="button"
          onClick={() => setShowGenericDesc(v => !v)}
          className="flex items-center gap-2 w-full text-left"
          aria-expanded={showGenericDesc}
        >
          <span
            className="flex items-center justify-center w-[22px] h-[22px] rounded-full text-[13px] shrink-0"
            style={{ background: "#fef3c7" }}
            aria-hidden="true"
          >
            ✨
          </span>
          <span className="flex-1 text-[13px] font-medium text-foreground">
            How Luma sees this toy
          </span>
          {!genericDesc && (
            <span className="text-[11px] text-muted-foreground font-normal">
              — add a description first
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${showGenericDesc ? "rotate-180" : ""}`}
          />
        </button>

        {showGenericDesc && (
          <div className="pl-[30px] pt-2">
            {genericDesc ? (
              <>
                <div
                  className="rounded-md p-2.5 text-[12px] leading-relaxed text-foreground"
                  style={{ background: "#fffbf5", border: "0.5px solid #fbbf24" }}
                >
                  {genericDesc}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                  Luma uses this to keep your toy consistent across illustrations. Update the description above to refresh it.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-snug">
                Save a toy description and Luma will generate a story-safe version.
              </p>
            )}
          </div>
        )}
      </div>

      {!hasToyName && (
        <p className="text-[11px] text-muted-foreground">Add a toy name to generate a companion illustration.</p>
      )}

      {hasToyName && (
        <>
          <IllustrationBlock
            type="toy"
            profileId={profile.id}
            profileName={fieldValues.toy_name}
            imageUrl={toyUrl}
            initialHistory={toyHistory}
            hasFieldsChanged={hasToyFieldsChanged}
            onRegenSuccess={url => setToyUrl(url)}
            onRestoreSuccess={(url, snapshot) => {
              setToyUrl(url)
              if (snapshot && Object.keys(snapshot).length > 0) {
                setToyRestorePrompt(snapshot)
                setToyFieldsRestored(false)
              }
            }}
          />

          {toyRestorePrompt && !toyFieldsRestored && (
            <div className="rounded-lg border border-border p-3 space-y-2 bg-card/50">
              <p className="text-[12px] text-muted-foreground">Want to restore the original description too?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setToyRestorePrompt(null)}
                  className="flex-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
                >
                  Keep current
                </button>
                <button
                  type="button"
                  onClick={() => { applyToySnapshot(toyRestorePrompt); setToyRestorePrompt(null) }}
                  className="flex-1 text-xs font-medium rounded px-2 py-1"
                  style={{ background: "#7c3aed", color: "white" }}
                >
                  Yes, restore fields
                </button>
              </div>
            </div>
          )}
          {toyFieldsRestored && (
            <p className="text-[11px] text-amber-400">Fields updated — save to keep these changes.</p>
          )}
        </>
      )}

      {/* ── Save / Error ── */}
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      {waitingForIllustration ? (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <svg className="animate-spin h-4 w-4" style={{ color: "#7c3aed" }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Creating new character art…
        </div>
      ) : (
        <Button type="submit" disabled={pending} className="w-full" style={{ background: "#7c3aed", color: "white" }}>
          {pending ? "Saving…" : profile ? "Save changes" : "Create character"}
        </Button>
      )}
    </form>
  )
}

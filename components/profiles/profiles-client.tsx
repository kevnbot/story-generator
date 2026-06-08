"use client"

import { useState, useTransition, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { ProfileForm } from "./profile-form"
import { deleteProfile } from "@/app/actions/profiles"
import { formatAge } from "@/lib/ai/prompt-builder"
import { createClient } from "@/lib/supabase/client"
import type { KidProfile } from "@/types"

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

interface IllustrationData {
  combined_reference_url: string | null
  character_illustration_url: string | null
  toy_reference_image_url: string | null
  illustration_status: string | null
  history: {
    character: HistoryRow[]
    toy: HistoryRow[]
  }
}

type Profile = KidProfile & { avatarUrl: string | null }

// ─── TradingCard ──────────────────────────────────────────────────────────────

function TradingCard({
  profile,
  onEdit,
  onDelete,
  pending,
}: {
  profile: Profile
  onEdit: () => void
  onDelete: () => void
  pending: boolean
}) {
  const toyName = profile.toy?.name && profile.toy.name !== "their favorite toy"
    ? profile.toy.name
    : null
  const trait = profile.personality_tags?.[0] ?? null

  const stats = [
    { label: "Age", value: formatAge(profile.age, profile.age_months ?? 0) },
    toyName ? { label: "Toy", value: toyName } : null,
    trait ? { label: "Trait", value: trait } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const isGenerating = profile.illustration_status === "generating" || profile.illustration_status === "pending"

  return (
    <div
      className="flex flex-col select-none overflow-hidden"
      style={{
        borderRadius: 16,
        border: "2.5px solid #7c3aed",
        background: "#1a0533",
        boxShadow: "0 4px 24px rgba(124,58,237,0.35), inset 0 1px 0 rgba(251,191,36,0.15)",
      }}
    >
      {/* ── Header bar ── */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5 shrink-0"
        style={{
          background: "linear-gradient(90deg, #4c1d95 0%, #7c3aed 60%, #6d28d9 100%)",
          borderBottom: "1px solid rgba(251,191,36,0.4)",
        }}
      >
        <p
          className="font-bold truncate text-sm leading-tight tracking-wide"
          style={{ color: "#fef3c7" }}
        >
          {profile.name}
        </p>
      </div>

      {/* ── Illustration ── */}
      <div
        className="relative shrink-0"
        style={{
          margin: "6px 6px 4px",
          borderRadius: 8,
          overflow: "hidden",
          border: "1.5px solid rgba(251,191,36,0.35)",
          aspectRatio: "3 / 4",
          background: "linear-gradient(160deg, #2e1065 0%, #1e1b4b 100%)",
        }}
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-contain" />
        ) : isGenerating ? (
          <div className="w-full h-full animate-pulse" style={{ background: "rgba(124,58,237,0.25)" }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🧒
          </div>
        )}
      </div>

      {/* ── Stats box ── */}
      <div
        className="mx-1.5 mt-1 px-2.5 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 6,
        }}
      >
        <div className="space-y-1.5">
          {stats.map(stat => (
            <div key={stat.label} className="flex items-baseline gap-1">
              <span
                className="text-[10px] font-bold uppercase tracking-wider shrink-0"
                style={{ color: "#a78bfa" }}
              >
                {stat.label}
              </span>
              <span
                className="text-[12px] capitalize line-clamp-2"
                style={{ color: "#e9d5ff" }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div
        className="flex items-center justify-between px-2 py-1.5 shrink-0 gap-1.5"
        style={{ borderTop: "1px solid rgba(167,139,250,0.2)" }}
      >
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          aria-label={`Edit ${profile.name}`}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: "rgba(124,58,237,0.25)",
            border: "1px solid rgba(124,58,237,0.5)",
            color: "#c4b5fd",
          }}
        >
          <Pencil className="w-2.5 h-2.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label={`Remove ${profile.name}`}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.35)",
            color: "#fca5a5",
          }}
        >
          <Trash2 className="w-2.5 h-2.5" />
          Remove
        </button>
      </div>
    </div>
  )
}

// ─── AddCard ──────────────────────────────────────────────────────────────────

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center transition-opacity hover:opacity-80"
      style={{
        borderRadius: 16,
        border: "2.5px dashed #7c3aed",
        background: "rgba(124,58,237,0.05)",
        minHeight: 280,
        color: "#7c3aed",
      }}
    >
      <span className="text-3xl mb-2">✦</span>
      <span className="text-sm font-semibold">Add character</span>
    </button>
  )
}

// ─── LumaGeneratingOverlay ────────────────────────────────────────────────────

function LumaGeneratingOverlay({
  profileId,
  name,
  onComplete,
  onError,
}: {
  profileId: string
  name: string
  onComplete: () => void
  onError: () => void
}) {
  const TIMEOUT_MS = 90_000
  const [timedOut, setTimedOut] = useState(false)
  const [failed, setFailed] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const message = elapsed < 20
    ? `Luma is drawing ${name}'s portrait…`
    : elapsed < 45
    ? `Now bringing their companion to life…`
    : `Almost done — putting it all together…`

  useEffect(() => {
    const startTime = Date.now()
    let done = false

    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    const poll = async () => {
      if (done) return
      if (Date.now() - startTime > TIMEOUT_MS) {
        done = true
        clearInterval(tick)
        setTimedOut(true)
        return
      }
      try {
        const res = await fetch(`/api/profiles/${profileId}/illustration-status`)
        if (res.ok) {
          const json = await res.json() as { illustration_status: string | null }
          const status = json.illustration_status
          if (status === "complete") {
            done = true
            clearInterval(tick)
            onCompleteRef.current()
            return
          }
          if (status === "failed") {
            done = true
            clearInterval(tick)
            setFailed(true)
            return
          }
        }
      } catch {
        // network error — keep polling
      }
      setTimeout(poll, 2000)
    }

    setTimeout(poll, 1000)
    return () => {
      done = true
      clearInterval(tick)
    }
  }, [profileId])

  if (timedOut || failed) {
    return (
      <div
        className="rounded-xl border p-8 flex flex-col items-center text-center gap-4"
        style={{ background: "#1a0533", borderColor: "rgba(124,58,237,0.4)" }}
      >
        <div className="text-4xl">🧞</div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "#e9d5ff" }}>
            {timedOut ? "This is taking longer than usual" : "Something went wrong"}
          </p>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#a78bfa" }}>
            {timedOut
              ? `${name}'s character was saved. The illustrations may still be generating in the background — check back in a moment.`
              : `${name}'s character was saved, but the illustrations didn't generate. You can regenerate them from the edit panel.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onError}
          className="px-4 py-2 rounded-full text-sm font-semibold"
          style={{ background: "rgba(124,58,237,0.3)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.5)" }}
        >
          Continue
        </button>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-8 flex flex-col items-center text-center gap-5"
      style={{ background: "#1a0533", borderColor: "rgba(124,58,237,0.4)", minHeight: 280 }}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl animate-pulse"
          style={{ background: "rgba(251,191,36,0.15)", border: "1.5px solid rgba(251,191,36,0.3)" }}
        >
          🪔
        </div>
        <div
          className="absolute w-2 h-2 rounded-full animate-spin"
          style={{
            background: "#fbbf24",
            top: 0,
            right: 4,
            animationDuration: "2s",
          }}
        />
      </div>

      <div>
        <p className="text-sm font-semibold" style={{ color: "#e9d5ff" }}>
          {message}
        </p>
        <p className="text-xs mt-1" style={{ color: "#7c5cbf" }}>
          This usually takes about 30–60 seconds
        </p>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: "#fbbf24",
              opacity: (elapsed % 3) === i ? 1 : 0.25,
              transition: "opacity 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── ProfilesClient ───────────────────────────────────────────────────────────

export function ProfilesClient({
  profiles: initialProfiles,
  accountId,
}: {
  profiles: Profile[]
  accountId: string
}) {
  // Realtime overrides keyed by profile id — merged on top of server-provided initialProfiles
  const [profileOverrides, setProfileOverrides] = useState<Record<string, Partial<Profile>>>({})
  const profiles = useMemo(
    () => initialProfiles.map(p => ({ ...p, ...profileOverrides[p.id] })),
    [initialProfiles, profileOverrides]
  )

  const [showForm, setShowForm] = useState(initialProfiles.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [generatingProfile, setGeneratingProfile] = useState<{
    profileId: string
    name: string
  } | null>(null)
  const [pending, startTransition] = useTransition()
  // Stores the last completed fetch result alongside the ID it belongs to
  const [illustrationFetch, setIllustrationFetch] = useState<{
    id: string
    data: IllustrationData | null
  } | null>(null)

  // Realtime subscription for illustration status updates
  useEffect(() => {
    if (!accountId) return
    const supabase = createClient()
    const channel = supabase
      .channel("profile-illustration-updates")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "kid_profiles",
        filter: `account_id=eq.${accountId}`,
      }, async (payload) => {
        const updated = payload.new as Record<string, unknown>
        const profileId = updated.id as string
        if (updated.illustration_status === "complete") {
          const res = await fetch(`/api/profiles/${profileId}/illustrations`)
          if (res.ok) {
            const data = await res.json() as {
              combined_reference_url?: string | null
              character_illustration_url?: string | null
              reference_image_url?: string | null
            }
            const freshAvatarUrl = data.combined_reference_url ?? data.character_illustration_url ?? data.reference_image_url ?? null
            setProfileOverrides(prev => ({
              ...prev,
              [profileId]: { ...prev[profileId], avatarUrl: freshAvatarUrl, illustration_status: "complete" },
            }))
          }
        } else {
          setProfileOverrides(prev => ({
            ...prev,
            [profileId]: { ...prev[profileId], illustration_status: updated.illustration_status as string | null },
          }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [accountId])

  useEffect(() => {
    if (!editingId) return
    const currentId = editingId
    let cancelled = false

    fetch(`/api/profiles/${currentId}/illustrations`)
      .then(res => {
        if (!res.ok) {
          console.error(`[profiles] illustration fetch failed: HTTP ${res.status} for profile ${currentId}`)
          return Promise.resolve(null)
        }
        return res.json() as Promise<IllustrationData>
      })
      .then(data => { if (!cancelled) setIllustrationFetch({ id: currentId, data }) })
      .catch(err => {
        console.error("[profiles] illustration fetch error:", err)
        if (!cancelled) setIllustrationFetch({ id: currentId, data: null })
      })

    return () => { cancelled = true }
  }, [editingId])

  const handleDelete = (id: string) => {
    startTransition(async () => { await deleteProfile(id) })
  }

  const editingProfile = profiles.find(p => p.id === editingId)
  // Loading is true when we have an editingId but haven't received its data yet
  const illustrationLoading = !!editingId && illustrationFetch?.id !== editingId
  const illustrationData = illustrationFetch?.id === editingId ? illustrationFetch.data : null

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Characters</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Each character stars in your stories</p>
        </div>
        {!showForm && !editingId && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#7c3aed", color: "white" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add character
          </button>
        )}
      </div>

      {/* Edit form — full width, above grid */}
      {editingId && editingProfile && (
        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-semibold mb-4">
            Edit {editingProfile.name}
          </h2>

          {illustrationLoading && (
            <div className="h-8 flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
              Loading illustration data…
            </div>
          )}

          {/*
            Key changes from "-pending" to "-loaded" once illustration data arrives,
            forcing ProfileForm to remount so its useState initializers pick up the
            history rows and resolved URLs from the API response.
            Server-resolved URLs from the page query are used as immediate fallbacks
            so the image is visible before the API call completes.
          */}
          <ProfileForm
            key={illustrationLoading ? `${editingId}-pending` : `${editingId}-loaded`}
            profile={{
              ...editingProfile,
              combined_reference_url:
                illustrationData?.combined_reference_url
                ?? editingProfile.combined_reference_url
                ?? null,
              character_illustration_url:
                illustrationData?.character_illustration_url
                ?? editingProfile.character_illustration_url
                ?? null,
              toy_reference_image_url:
                illustrationData?.toy_reference_image_url
                ?? editingProfile.toy_reference_image_url
                ?? null,
              illustration_status:
                illustrationData?.illustration_status
                ?? editingProfile.illustration_status
                ?? null,
              character_history: illustrationData?.history.character ?? [],
              toy_history: illustrationData?.history.toy ?? [],
            }}
            onSuccess={() => setEditingId(null)}
            waitForIllustration={true}
            profileId={editingId ?? undefined}
          />
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground w-full text-center"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Card grid */}
      {!editingId && (
        <div className="grid grid-cols-2 gap-4">
          {profiles.map(profile => (
            <TradingCard
              key={profile.id}
              profile={profile}
              onEdit={() => { setShowForm(false); setEditingId(profile.id) }}
              onDelete={() => handleDelete(profile.id)}
              pending={pending}
            />
          ))}
          {/* Add card always visible in grid */}
          {!showForm && (
            <AddCard onClick={() => setShowForm(true)} />
          )}
        </div>
      )}

      {/* Add form */}
      {showForm && !editingId && (
        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-semibold mb-4">
            {profiles.length === 0 ? "Add your first character" : "New character"}
          </h2>
          <ProfileForm
            onCreated={(profileId, name) => {
              setShowForm(false)
              setGeneratingProfile({ profileId, name })
            }}
          />
          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground w-full text-center"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Luma generating overlay */}
      {generatingProfile && !editingId && (
        <LumaGeneratingOverlay
          profileId={generatingProfile.profileId}
          name={generatingProfile.name}
          onComplete={() => setGeneratingProfile(null)}
          onError={() => setGeneratingProfile(null)}
        />
      )}

      {/* Empty state */}
      {profiles.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <div className="text-5xl">🧞</div>
          <div>
            <p className="font-semibold text-foreground">No characters yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first character to start making wishes
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            style={{ background: "#7c3aed", color: "white" }}
          >
            Add a character
          </Button>
        </div>
      )}
    </div>
  )
}

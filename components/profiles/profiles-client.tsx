"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import { ProfileForm } from "./profile-form"
import { deleteProfile } from "@/app/actions/profiles"
import { formatAge } from "@/lib/ai/prompt-builder"

interface Profile {
  id: string
  name: string
  age: number
  age_months: number
  gender?: string
  appearance: { hair?: string; hair_color?: string; eye_color?: string; skin_tone?: string }
  personality_tags: string[]
  toy: { name: string; description?: string; type?: string }
  reference_image_url?: string | null
}

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
          height: 160,
          background: "linear-gradient(160deg, #2e1065 0%, #1e1b4b 100%)",
        }}
      >
        {profile.reference_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.reference_image_url}
            alt={profile.name}
            className="w-full h-full object-contain"
          />
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

// ─── ProfilesClient ───────────────────────────────────────────────────────────

export function ProfilesClient({ profiles }: { profiles: Profile[] }) {
  const [showForm, setShowForm] = useState(profiles.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    startTransition(async () => { await deleteProfile(id) })
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Characters</h1>
        <p className="text-sm mt-0.5" style={{ color: "#a78bfa" }}>
          Each character stars in your stories
        </p>
      </div>

      {/* Edit form — full width, above grid */}
      {editingId && (
        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-semibold mb-4">
            Edit {profiles.find(p => p.id === editingId)?.name}
          </h2>
          <ProfileForm
            profile={profiles.find(p => p.id === editingId)}
            onSuccess={() => setEditingId(null)}
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
          <ProfileForm onSuccess={() => setShowForm(false)} />
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

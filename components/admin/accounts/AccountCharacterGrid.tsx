import { formatAge } from "@/lib/ai/prompt-builder"

export type AccountCharacter = {
  id: string
  name: string
  age: number
  age_months: number | null
  personality_tags: string[] | null
  toy: { name?: string } | null
  illustration_status: string | null
  avatarUrl: string | null
}

function CharacterCard({ profile }: { profile: AccountCharacter }) {
  const toyName =
    profile.toy?.name && profile.toy.name !== "their favorite toy" ? profile.toy.name : null
  const trait = profile.personality_tags?.[0] ?? null

  const stats = [
    { label: "Age", value: formatAge(profile.age, profile.age_months ?? 0) },
    toyName ? { label: "Toy", value: toyName } : null,
    trait ? { label: "Trait", value: trait } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const isGenerating =
    profile.illustration_status === "generating" || profile.illustration_status === "pending"

  return (
    <div
      className="flex flex-col select-none overflow-hidden"
      style={{
        borderRadius: 12,
        border: "2px solid #7c3aed",
        background: "#1a0533",
        boxShadow: "0 3px 16px rgba(124,58,237,0.3), inset 0 1px 0 rgba(251,191,36,0.15)",
      }}
    >
      {/* Header */}
      <div
        className="px-2 py-1 shrink-0"
        style={{
          background: "linear-gradient(90deg, #4c1d95 0%, #7c3aed 60%, #6d28d9 100%)",
          borderBottom: "1px solid rgba(251,191,36,0.4)",
        }}
      >
        <p className="font-bold truncate text-xs leading-tight tracking-wide" style={{ color: "#fef3c7" }}>
          {profile.name}
        </p>
      </div>

      {/* Illustration */}
      <div
        className="relative shrink-0"
        style={{
          margin: "5px 5px 3px",
          borderRadius: 6,
          overflow: "hidden",
          border: "1.5px solid rgba(251,191,36,0.35)",
          height: 110,
          background: "linear-gradient(160deg, #2e1065 0%, #1e1b4b 100%)",
        }}
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-contain" />
        ) : isGenerating ? (
          <div className="w-full h-full animate-pulse" style={{ background: "rgba(124,58,237,0.25)" }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🧒</div>
        )}
      </div>

      {/* Stats */}
      <div
        className="mx-1.5 mt-0.5 mb-1.5 px-2 py-1.5"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 5,
        }}
      >
        <div className="space-y-1">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-1">
              <span
                className="text-[9px] font-bold uppercase tracking-wider shrink-0"
                style={{ color: "#a78bfa" }}
              >
                {stat.label}
              </span>
              <span className="text-[11px] capitalize line-clamp-1" style={{ color: "#e9d5ff" }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AccountCharacterGrid({ profiles }: { profiles: AccountCharacter[] }) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-nav-border bg-white p-6 text-sm text-muted-foreground">
        No characters created.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {profiles.map((profile) => (
        <CharacterCard key={profile.id} profile={profile} />
      ))}
    </div>
  )
}

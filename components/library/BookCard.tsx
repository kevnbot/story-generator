"use client"

import Link from "next/link"
import { Story } from "@/types"

// ─── Colour palette ───────────────────────────────────────────────────────────
// Each palette has a spine colour and a cover gradient.
// Down the road, a user-chosen colour can be stored on the story row and
// override this random assignment.

const BOOK_PALETTES = [
  { spine: "#3730a3", from: "#4f46e5", to: "#3730a3" }, // indigo
  { spine: "#9f1239", from: "#e11d48", to: "#9f1239" }, // rose
  { spine: "#065f46", from: "#059669", to: "#065f46" }, // emerald
  { spine: "#92400e", from: "#d97706", to: "#92400e" }, // amber
  { spine: "#0c4a6e", from: "#0284c7", to: "#0c4a6e" }, // sky
  { spine: "#5b21b6", from: "#7c3aed", to: "#5b21b6" }, // violet
  { spine: "#831843", from: "#db2777", to: "#831843" }, // pink
  { spine: "#134e4a", from: "#0d9488", to: "#134e4a" }, // teal
] as const

// Derive a stable palette index from the story ID so the same story always
// gets the same colour, but it looks random across stories.
function paletteFromId(id: string): (typeof BOOK_PALETTES)[number] {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return BOOK_PALETTES[hash % BOOK_PALETTES.length]
}

// ─── Emoji helper ────────────────────────────────────────────────────────────
// Picks an emoji based on keywords in the story title.
// Replace this later when cover images are introduced (v2 credit feature).

const TITLE_EMOJI_MAP: [RegExp, string][] = [
  [/dragon|fire|flame/i, "🐉"],
  [/moon|night|star|sky/i, "🌙"],
  [/garden|flower|plant|tree/i, "🌸"],
  [/ocean|sea|whale|fish|wave/i, "🐋"],
  [/unicorn|magic|wizard|spell/i, "🦄"],
  [/castle|knight|princess|prince/i, "🏰"],
  [/forest|wood|bear|fox|wolf/i, "🌲"],
  [/space|rocket|planet|alien/i, "🚀"],
  [/dinosaur|dino/i, "🦕"],
  [/robot/i, "🤖"],
  [/pirate|treasure|ship/i, "🏴‍☠️"],
  [/butterfly|fairy/i, "🦋"],
  [/cat|kitten/i, "🐱"],
  [/dog|puppy/i, "🐶"],
  [/bird|owl|eagle/i, "🦉"],
  [/adventure|quest|journey/i, "⚔️"],
  [/dream|sleep/i, "💤"],
]

function emojiFromTitle(title: string): string {
  for (const [pattern, emoji] of TITLE_EMOJI_MAP) {
    if (pattern.test(title)) return emoji
  }
  return "📖"
}

// ─── Word count → length label ───────────────────────────────────────────────

export function storyLengthLabel(content: string): "short" | "medium" | "long" {
  const words = content.trim().split(/\s+/).length
  if (words < 300) return "short"
  if (words < 600) return "medium"
  return "long"
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookCardProps {
  story: Story
  childName?: string // resolved from kid_profile_id by parent
  isNew?: boolean    // true if created in the last 24h
}

export default function BookCard({ story, childName, isNew }: BookCardProps) {
  const palette = paletteFromId(story.id)
  const emoji = emojiFromTitle(story.title)
  const dateLabel = new Date(story.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

  return (
    <Link href={`/library/${story.id}`} className="group flex flex-col items-center gap-2.5 focus:outline-none">
      {/* Book */}
      <div
        className="relative w-full cursor-pointer transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:rotate-1 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-brand-500"
        style={{ aspectRatio: "2/3", borderRadius: "3px 10px 10px 3px" }}
      >
        {/* Spine */}
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center"
          style={{
            width: 14,
            background: palette.spine,
            borderRadius: "3px 0 0 3px",
          }}
        >
          <div className="h-[70%] w-px opacity-30 bg-white" />
        </div>

        {/* Cover */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-end overflow-hidden"
          style={{
            left: 14,
            borderRadius: "0 10px 10px 0",
            background: `linear-gradient(160deg, ${palette.from} 0%, ${palette.to} 100%)`,
          }}
        >
          {/* Emoji illustration — placeholder for future cover art */}
          <div
            className="absolute inset-0 flex items-center justify-center pb-8 select-none"
            style={{ fontSize: 44, opacity: 0.45 }}
            aria-hidden="true"
          >
            {emoji}
          </div>

          {/* Title area */}
          <div className="relative z-10 w-full px-2.5 pb-3 text-center">
            <p
              className="font-serif text-[11px] font-semibold leading-tight text-white/95"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
            >
              {story.title}
            </p>
            {childName && (
              <p className="mt-1 text-[10px] font-semibold text-white/65">
                ✦ {childName}
              </p>
            )}
          </div>
        </div>

        {/* New badge */}
        {isNew && (
          <div
            className="absolute right-2 top-2 z-20 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ color: "#44403c" }}
          >
            New
          </div>
        )}
      </div>

      {/* Below-book metadata */}
      <div className="w-full text-center">
        <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
      </div>
    </Link>
  )
}

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

// ─── Spine title truncation ───────────────────────────────────────────────────
// CSS line-clamp doesn't reliably work with writing-mode: vertical-rl, so we
// truncate in JS to keep the spine to roughly 2 visual lines (~18 chars).

function truncateSpineTitle(title: string): string {
  // Approx 12 chars per visual line at 10px font in 80px height → 18 chars fits 2 lines
  if (title.length <= 18) return title
  return title.slice(0, 16).trimEnd() + "..."
}

// ─── Spine height ─────────────────────────────────────────────────────────────

const SPINE_HEIGHTS = [100, 108, 115, 122, 110]

function spineHeightFromId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return SPINE_HEIGHTS[hash % SPINE_HEIGHTS.length]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookCardProps {
  story: Story
  childName?: string
  isActive: boolean
  onActivate: () => void
  onDismiss: () => void
}

export default function BookCard({ story, childName, isActive, onActivate, onDismiss }: BookCardProps) {
  const palette = paletteFromId(story.id)
  const emoji = emojiFromTitle(story.title)
  const height = spineHeightFromId(story.id)
  const initial = childName ? childName[0].toUpperCase() : null

  return (
    <div
      className={`book-wrap${isActive ? " active" : ""}`}
      onClick={(e) => {
        if (isActive) {
          onDismiss()
        } else {
          e.stopPropagation()
          onActivate()
        }
      }}
      style={{
        position: "relative",
        width: "44px",
        height: `${height}px`,
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      {/* Popover — shown on hover (CSS) or when active (JS class) */}
      <div
        className="title-popover"
        style={{
          position: "absolute",
          bottom: "calc(100% + 10px)",
          left: "50%",
          transform: "translateX(-50%) translateY(4px)",
          background: "#1c1209",
          border: "1px solid rgba(200,133,42,0.4)",
          borderRadius: "8px",
          padding: "8px 10px",
          minWidth: "130px",
          maxWidth: "160px",
          zIndex: 10,
          textAlign: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          opacity: 0,
          pointerEvents: "none",
          transition: "opacity 0.15s ease, transform 0.15s ease",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "rgba(255,220,150,0.95)",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {story.title}
        </p>
        {childName && (
          <p style={{ fontSize: "11px", color: "rgba(200,150,80,0.65)", margin: "4px 0 0" }}>
            ✦ {childName}
          </p>
        )}
        <Link
          href={`/library/${story.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-block",
            marginTop: "8px",
            background: "#7c3aed",
            color: "white",
            fontSize: "11px",
            fontWeight: 500,
            padding: "5px 14px",
            borderRadius: "20px",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          Read story
        </Link>
      </div>

      {/* Spine visual */}
      <div
        className="book-spine"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "2px 4px 4px 2px",
          background: `linear-gradient(180deg, ${palette.from} 0%, ${palette.spine} 100%)`,
          boxShadow: "2px 0 4px rgba(0,0,0,0.4), inset -1px 0 0 rgba(255,255,255,0.08)",
          transition: "transform 0.18s ease",
        }}
      >
        {/* Binding — left edge dark strip */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: "5px",
            background: "rgba(0,0,0,0.35)",
            borderRadius: "2px 0 0 2px",
          }}
        />

        {/* Spine content */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "5px",
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
          }}
        >
          {/* Story type emoji */}
          <span style={{ fontSize: "14px", lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
            {emoji}
          </span>

          {/* Title — JS-truncated to ~2 visual lines; full title is in the popover */}
          <span
            aria-hidden="true"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              fontSize: 10,
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              letterSpacing: "0.2px",
              overflow: "hidden",
              maxHeight: 80,
              width: "100%",
              textAlign: "center",
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {truncateSpineTitle(story.title)}
          </span>

          {/* Child initial circle, or ✦ if no child */}
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              color: "white",
              flexShrink: 0,
            }}
          >
            {initial ?? "✦"}
          </div>
        </div>
      </div>
    </div>
  )
}

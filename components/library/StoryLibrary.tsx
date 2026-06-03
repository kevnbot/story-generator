"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Story, KidProfile, StoryTemplate } from "@/types"
import BookCard from "./BookCard"
import {
  FilterState,
  SortKey,
  FilterOption,
  DATE_RANGE_OPTIONS,
  LENGTH_OPTIONS,
  SORT_DEFS,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  applyFiltersAndSort,
} from "./filters"

// ─── FilterDropdown ───────────────────────────────────────────────────────────

interface FilterDropdownProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const active = value !== "all" && value !== ""

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "appearance-none cursor-pointer rounded-full border px-3 py-1 pr-7 text-[12px] font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-genie-purple-600 focus:ring-offset-1",
          active
            ? "border-transparent bg-genie-purple-600 text-white"
            : "border-border bg-transparent text-muted-foreground hover:bg-genie-purple-50",
        ].join(" ")}
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={[
          "pointer-events-none absolute right-2 h-3 w-3",
          active ? "text-white" : "text-muted-foreground",
        ].join(" ")}
        aria-hidden="true"
      />
    </label>
  )
}

// ─── SortDropdown ─────────────────────────────────────────────────────────────

interface SortDropdownProps {
  value: SortKey
  onChange: (value: SortKey) => void
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="appearance-none cursor-pointer rounded-full border border-border bg-transparent px-3 py-1 pr-7 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        aria-label="Sort stories"
      >
        {SORT_DEFS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 h-3 w-3 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  )
}

// ─── NewStorySlot ─────────────────────────────────────────────────────────────

function NewStorySlot() {
  return (
    <Link
      href="/generate"
      style={{
        backgroundColor: "#f5f0ff",
        border: "1.5px dashed #c4b5fd",
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        aspectRatio: "2/3",
        textDecoration: "none",
        gap: "4px",
      }}
      aria-label="Generate a new story"
    >
      <span style={{ fontSize: "18px", color: "#7c3aed" }}>✦</span>
      <span style={{ fontSize: "10px", fontWeight: 500, color: "#7c3aed" }}>New story</span>
    </Link>
  )
}

// ─── BookshelfSVG ─────────────────────────────────────────────────────────────

function BookshelfSVG({ isEmpty, storyCount }: { isEmpty: boolean; storyCount: number }) {
  const spineColors = ["#7c3aed","#f59e0b","#0d9488","#ef4444","#1d4ed8","#16a34a","#ec4899","#6b7280"]
  const bookCount = Math.min(storyCount, 8)

  return (
    <svg viewBox="0 0 320 120" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: "320px" }} aria-hidden="true">
      <rect x="0" y="88" width="320" height="14" rx="3" fill="#c2820a" />
      <rect x="0" y="98" width="320" height="6" rx="2" fill="#a06910" />
      {isEmpty ? (
        <g transform="translate(140, 30)">
          <ellipse cx="20" cy="52" rx="22" ry="10" fill="#fbbf24" opacity="0.3" />
          <path d="M8 50 Q6 35 12 28 Q18 18 28 20 Q38 18 40 30 Q44 42 36 50 Z" fill="#fbbf24" />
          <path d="M8 50 Q18 55 36 50 Q30 58 22 58 Q14 58 8 50 Z" fill="#f59e0b" />
          <path d="M36 38 Q50 32 52 38 Q50 44 40 42" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
          <path d="M8 42 Q0 42 0 50 Q0 58 8 56" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="20" cy="18" rx="6" ry="8" fill="#fef3c7" opacity="0.8" />
          <ellipse cx="20" cy="14" rx="3" ry="5" fill="#fbbf24" opacity="0.6" />
          <text x="-8" y="10" fontSize="10" fill="#fbbf24" opacity="0.8">✦</text>
          <text x="38" y="8" fontSize="8" fill="#fbbf24" opacity="0.6">✦</text>
          <text x="10" y="2" fontSize="6" fill="#fbbf24" opacity="0.5">✦</text>
        </g>
      ) : (
        <g>
          {Array.from({ length: bookCount }).map((_, i) => {
            const x = 12 + i * 32
            const height = 44 + (i % 3) * 10
            const y = 88 - height
            const color = spineColors[i % spineColors.length]
            return (
              <g key={i}>
                <rect x={x} y={y} width="24" height={height} rx="2" fill={color} opacity="0.85" />
                <rect x={x} y={y} width="3" height={height} rx="1" fill="white" opacity="0.15" />
              </g>
            )
          })}
          <g transform={`translate(${12 + bookCount * 32 + 4}, 44)`}>
            <path d="M4 44 Q3 32 7 26 Q11 18 17 19 Q23 18 24 27 Q26 36 22 44 Z" fill="#fbbf24" opacity="0.9" />
            <path d="M4 44 Q13 48 22 44 Q18 50 13 50 Q8 50 4 44 Z" fill="#f59e0b" />
            <path d="M22 34 Q30 30 31 34 Q30 38 24 37" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="13" cy="15" rx="3" ry="4" fill="#fef3c7" opacity="0.8" />
            <text x="22" y="8" fontSize="7" fill="#fbbf24" opacity="0.7">✦</text>
            <text x="2" y="12" fontSize="5" fill="#fbbf24" opacity="0.5">✦</text>
          </g>
        </g>
      )}
    </svg>
  )
}

// ─── StoryLibrary ─────────────────────────────────────────────────────────────

interface StoryLibraryProps {
  stories: Story[]
  profiles: KidProfile[]    // for child filter labels + resolving childName on cards
  templates: StoryTemplate[] // for template filter labels
}

export default function StoryLibrary({ stories, profiles, templates }: StoryLibraryProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT)
  // Read on first render to decide whether to skip the enter animation
  const [skipEnter] = useState(() => {
    if (typeof window === "undefined") return false
    return !!sessionStorage.getItem("luma_library_seen")
  })

  // Mark seen after mount so the next visit skips the enter animation
  useEffect(() => {
    sessionStorage.setItem("luma_library_seen", "1")
  }, [])

  // Build dynamic child options from loaded profiles
  const childOptions: FilterOption[] = [
    { value: "all", label: "All kids" },
    ...profiles.map((p) => ({ value: p.id, label: p.name })),
  ]

  // Build dynamic template options from loaded templates
  const templateOptions: FilterOption[] = [
    { value: "all", label: "All templates" },
    ...templates.map((t) => ({ value: t.id, label: t.name })),
  ]

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const visibleStories = useMemo(
    () => applyFiltersAndSort(stories, filters, sort),
    [stories, filters, sort]
  )

  const [now] = useState(() => Date.now())
  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.name])),
    [profiles]
  )

  const activeFilterCount = Object.entries(filters).filter(
    ([, v]) => v !== "all"
  ).length

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
    setSort(DEFAULT_SORT)
  }

  return (
    <section aria-label="Story library">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold" style={{ color: "#2e1065" }}>Your story shelf</h1>
          {stories.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {visibleStories.length} {visibleStories.length === 1 ? "story" : "stories"}
              {activeFilterCount > 0 && (
                <> of {stories.length}</>
              )}
            </span>
          )}
        </div>
        {stories.length > 0 && (
          <p className="text-sm mt-0.5" style={{ color: "#a78bfa" }}>
            {`${stories.length} ${stories.length === 1 ? "story" : "stories"} granted so far`}
          </p>
        )}
      </div>

      {/* Filter bar ─────────────────────────────────────────────────────────
          To add a new filter, add a <FilterDropdown> here and a matching
          entry in FilterState + filters.ts. The applyFiltersAndSort function
          handles the logic. The sort dropdown always lives at the end.
      ──────────────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="All kids"
          value={filters.childId}
          options={childOptions}
          onChange={(v) => setFilter("childId", v)}
        />
        <FilterDropdown
          label="Any date"
          value={filters.dateRange}
          options={DATE_RANGE_OPTIONS}
          onChange={(v) => setFilter("dateRange", v)}
        />
        <FilterDropdown
          label="Any length"
          value={filters.length}
          options={LENGTH_OPTIONS}
          onChange={(v) => setFilter("length", v)}
        />
        {templates.length > 0 && (
          <FilterDropdown
            label="All templates"
            value={filters.template}
            options={templateOptions}
            onChange={(v) => setFilter("template", v)}
          />
        )}

        {/* Spacer pushes sort to the right */}
        <div className="flex-1" />

        <SortDropdown value={sort} onChange={setSort} />

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="rounded-full border border-border px-3 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bookshelf — shown when stories exist */}
      {stories.length > 0 && (
        <div className="mb-5 flex justify-center">
          <BookshelfSVG isEmpty={false} storyCount={visibleStories.length} />
        </div>
      )}

      {/* Book grid */}
      {visibleStories.length === 0 && stories.length > 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No stories match these filters.{" "}
          <button onClick={clearFilters} className="underline hover:text-foreground">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visibleStories.map((story) => (
            <BookCard
              key={story.id}
              story={story}
              childName={story.kid_profile_id ? profileMap[story.kid_profile_id] : undefined}
              isNew={now - new Date(story.created_at).getTime() < 24 * 60 * 60 * 1000}
            />
          ))}
          <NewStorySlot />
        </div>
      )}

      {/* Empty state — no stories at all */}
      {stories.length === 0 && (
        <>
          <style>{`
            @keyframes luma-float {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-6px); }
            }
            @keyframes tail-sway {
              0%, 100% { transform: scaleX(1) rotate(0deg); }
              50%       { transform: scaleX(0.92) rotate(2deg); }
            }
            @keyframes blink {
              0%, 90%, 100% { transform: scaleY(1); }
              95%           { transform: scaleY(0.08); }
            }
            @keyframes luma-enter {
              0%   { opacity: 0; transform: translateY(30px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes sparkle-pop {
              0%   { opacity: 0; transform: scale(0) translateY(0); }
              40%  { opacity: 1; transform: scale(1.2) translateY(-8px); }
              100% { opacity: 0; transform: scale(0.5) translateY(-18px); }
            }
            @keyframes btn-lift {
              0%, 100% { transform: translateY(0); }
              50%       { transform: translateY(-2px); }
            }
            .luma-lib-enter {
              animation: luma-enter 0.6s ease-out forwards, luma-float 3.5s ease-in-out 0.6s infinite;
            }
            .luma-lib-no-enter {
              animation: luma-float 3.5s ease-in-out infinite;
            }
            .luma-lib-tail {
              display: block;
              animation: tail-sway 3.5s ease-in-out infinite;
              transform-origin: 50% 20%;
            }
            .luma-lib-blink {
              animation: blink 4s ease-in-out 2s infinite;
              transform-origin: center center;
            }
            .luma-lib-sparkle-0 { animation: sparkle-pop 1.8s ease-out 0s infinite; }
            .luma-lib-sparkle-1 { animation: sparkle-pop 1.8s ease-out 0.9s infinite; }
            .luma-lib-sparkle-2 { animation: sparkle-pop 1.8s ease-out 1.5s infinite; }
            .luma-lib-btn { animation: btn-lift 2.5s ease-in-out 1s infinite; }
          `}</style>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "32px 0", textAlign: "center" }}>
            {/* Copy */}
            <div>
              <p className="text-base font-semibold" style={{ color: "#2e1065" }}>Your story shelf is empty.</p>
              <p className="text-sm mt-1" style={{ color: "#a78bfa" }}>Let&apos;s grant your wishes.</p>
            </div>

            {/* Luma + shelf row */}
            <div style={{ display: "flex", alignItems: "flex-end", width: "100%", maxWidth: "360px" }}>
              {/* Luma — bottom-left beside bookshelf */}
              <div
                className={skipEnter ? "luma-lib-no-enter" : "luma-lib-enter"}
                style={{ position: "relative", width: "72px", height: "72px", flexShrink: 0 }}
              >
                {/* Sparkles */}
                <span
                  className="luma-lib-sparkle-0"
                  style={{ position: "absolute", top: "-4px", right: "-2px", fontSize: "10px", color: "#fbbf24", pointerEvents: "none", zIndex: 1 }}
                  aria-hidden="true"
                >✦</span>
                <span
                  className="luma-lib-sparkle-1"
                  style={{ position: "absolute", top: "6px", right: "-14px", fontSize: "8px", color: "#7c3aed", pointerEvents: "none", zIndex: 1 }}
                  aria-hidden="true"
                >✦</span>
                <span
                  className="luma-lib-sparkle-2"
                  style={{ position: "absolute", top: "-12px", left: "4px", fontSize: "6px", color: "#fbbf24", pointerEvents: "none", zIndex: 1 }}
                  aria-hidden="true"
                >✦</span>

                {/* Image with tail-sway applied via wrapper span */}
                <span className="luma-lib-tail">
                  <Image
                    src="/mascot/luma.png"
                    alt="Luma, your story genie"
                    width={72}
                    height={72}
                    priority
                    style={{ display: "block" }}
                  />
                </span>

                {/* Blink overlay — approximate eye position at 72px */}
                <span
                  className="luma-lib-blink"
                  style={{
                    position: "absolute",
                    top: "26px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "28px",
                    height: "4px",
                    background: "linear-gradient(90deg, rgba(180,140,100,0) 0%, rgba(180,140,100,0.65) 30%, rgba(180,140,100,0.65) 70%, rgba(180,140,100,0) 100%)",
                    borderRadius: "2px",
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                />
              </div>

              {/* Bookshelf fills remaining width */}
              <div style={{ flex: 1 }}>
                <BookshelfSVG isEmpty storyCount={0} />
              </div>
            </div>

            {/* CTA — full width pill, purple */}
            <Link
              href="/generate"
              className="luma-lib-btn"
              style={{
                display: "block",
                width: "100%",
                maxWidth: "360px",
                backgroundColor: "#7c3aed",
                color: "#ffffff",
                borderRadius: "999px",
                padding: "14px 24px",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              Grant my first wish
            </Link>
          </div>
        </>
      )}
    </section>
  )
}

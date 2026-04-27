"use client"

import { useState, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import Link from "next/link"
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
// A single labelled dropdown pill. Self-contained so it can be reused
// for any filter key without extra wiring.

interface FilterDropdownProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const active = value !== "all" && value !== ""
  const currentLabel = options.find((o) => o.value === value)?.label ?? label

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "appearance-none cursor-pointer rounded-full border px-3 py-1 pr-7 text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
          active
            ? "border-transparent bg-foreground text-background"
            : "border-border bg-transparent text-muted-foreground hover:bg-muted",
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
          active ? "text-background" : "text-muted-foreground",
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
        className="appearance-none cursor-pointer rounded-full border border-border bg-transparent px-3 py-1 pr-7 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
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
      className="group flex flex-col items-center gap-2.5 focus:outline-none"
    >
      <div
        className="flex w-full flex-col items-center justify-center gap-2 border-[1.5px] border-dashed border-border text-muted-foreground transition-colors group-hover:border-foreground/40 group-hover:bg-muted group-focus-visible:ring-2 group-focus-visible:ring-brand-500"
        style={{ aspectRatio: "2/3", borderRadius: "3px 10px 10px 3px" }}
        aria-label="Generate a new story"
      >
        <span className="text-2xl leading-none" aria-hidden="true">+</span>
        <span className="text-[11px] font-semibold">New story</span>
      </div>
      {/* spacer to align with book metadata below siblings */}
      <div className="h-[15px]" aria-hidden="true" />
    </Link>
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

  const now = Date.now()
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
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Our Library
        </h1>
        <span className="text-sm text-muted-foreground">
          {visibleStories.length} {visibleStories.length === 1 ? "story" : "stories"}
          {activeFilterCount > 0 && (
            <> of {stories.length}</>
          )}
        </span>
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

      {/* Book grid */}
      {visibleStories.length === 0 && stories.length > 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No stories match these filters.{" "}
          <button onClick={clearFilters} className="underline hover:text-foreground">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span className="text-5xl" aria-hidden="true">📚</span>
          <p className="text-lg font-semibold text-foreground">No stories yet</p>
          <p className="text-sm text-muted-foreground">
            Generate your first bedtime story to start building your library.
          </p>
          <Link
            href="/generate"
            className="mt-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Create a story
          </Link>
        </div>
      )}
    </section>
  )
}

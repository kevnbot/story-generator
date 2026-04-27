import { Story } from "@/types"
import { storyLengthLabel } from "./BookCard"

// ─── Filter & Sort types ──────────────────────────────────────────────────────
//
// HOW TO ADD A NEW FILTER:
// 1. Add a key to FilterState
// 2. Add a FilterDef entry to FILTER_DEFS
// 3. Done — the UI and apply logic wire up automatically.
//
// HOW TO ADD A NEW SORT:
// 1. Add a SortDef entry to SORT_DEFS
// 2. Done.
//
// For nested/tiered filtering in future, each FilterDef can receive a
// `children` array of sub-FilterDefs, and the UI can render them
// indented when the parent is active.

export interface FilterState {
  childId: string       // kid_profile_id | "all"
  dateRange: string     // "all" | "7d" | "30d" | "90d"
  length: string        // "all" | "short" | "medium" | "long"
  template: string      // story_template_id | "all"
  // Add new filter keys here as features grow
}

export type SortKey = "newest" | "oldest" | "title_asc" | "title_desc"

export interface ActiveFilters {
  filters: FilterState
  sort: SortKey
}

// ─── Option types ─────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string
  label: string
}

export interface FilterDef {
  key: keyof FilterState
  label: string          // shown in the filter bar
  options: FilterOption[]
  // Future: children?: FilterDef[]  — for nested/tiered filters
}

export interface SortDef {
  value: SortKey
  label: string
}

// ─── Static filter options ────────────────────────────────────────────────────

export const DATE_RANGE_OPTIONS: FilterOption[] = [
  { value: "all",  label: "Any date"    },
  { value: "7d",   label: "Last 7 days" },
  { value: "30d",  label: "Last 30 days"},
  { value: "90d",  label: "Last 90 days"},
]

export const LENGTH_OPTIONS: FilterOption[] = [
  { value: "all",    label: "Any length" },
  { value: "short",  label: "Short"      },  // < 300 words
  { value: "medium", label: "Medium"     },  // 300–599 words
  { value: "long",   label: "Long"       },  // 600+ words
]

export const SORT_DEFS: SortDef[] = [
  { value: "newest",     label: "Newest first" },
  { value: "oldest",     label: "Oldest first" },
  { value: "title_asc",  label: "A → Z"        },
  { value: "title_desc", label: "Z → A"        },
]

// ─── Default state ────────────────────────────────────────────────────────────

export const DEFAULT_FILTERS: FilterState = {
  childId:   "all",
  dateRange: "all",
  length:    "all",
  template:  "all",
}

export const DEFAULT_SORT: SortKey = "newest"

// ─── Apply filters + sort ─────────────────────────────────────────────────────

export function applyFiltersAndSort(
  stories: Story[],
  filters: FilterState,
  sort: SortKey
): Story[] {
  let result = [...stories]

  // Child filter
  if (filters.childId !== "all") {
    result = result.filter((s) => s.kid_profile_id === filters.childId)
  }

  // Date range filter
  if (filters.dateRange !== "all") {
    const days = parseInt(filters.dateRange)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    result = result.filter((s) => new Date(s.created_at) >= cutoff)
  }

  // Length filter
  if (filters.length !== "all") {
    result = result.filter((s) => storyLengthLabel(s.content) === filters.length)
  }

  // Template filter
  if (filters.template !== "all") {
    result = result.filter((s) => s.story_template_id === filters.template)
  }

  // Sort
  result.sort((a, b) => {
    switch (sort) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case "title_asc":
        return a.title.localeCompare(b.title)
      case "title_desc":
        return b.title.localeCompare(a.title)
      default:
        return 0
    }
  })

  return result
}

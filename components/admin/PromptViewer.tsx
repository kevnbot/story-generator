"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react"
import { Story } from "@/types"
import { Pagination } from "@/components/admin/Pagination"

const PAGE_SIZE = 20

export type PromptLogRow = {
  story: Story
  ownerName: string
  ownerEmail: string | null
}

type SortKey = "title" | "ownerName" | "created_at"
type SortDir = "asc" | "desc"

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "title", label: "Story" },
  { key: "ownerName", label: "Owner" },
  { key: null, label: "Characters" },
  { key: "created_at", label: "Created" },
  { key: null, label: "" },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

// ─── PromptBlock ──────────────────────────────────────────────────────────────

function PromptBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-[12px] leading-relaxed text-foreground">
        {content}
      </pre>
    </div>
  )
}

// ─── StoryRow ─────────────────────────────────────────────────────────────────

function StoryRow({ row }: { row: PromptLogRow }) {
  const { story, ownerName, ownerEmail } = row
  const [open, setOpen] = useState(false)
  const params = story.generation_params
  const characters = params?.kid_names?.join(", ") || "—"

  return (
    <>
      <tr
        className="cursor-pointer align-top transition-colors hover:bg-nav-bg"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-muted-foreground">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{story.title}</p>
              {story.has_images && (
                <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                  images
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="text-foreground">{ownerName}</p>
          {ownerEmail && ownerEmail !== ownerName && (
            <p className="text-xs text-muted-foreground">{ownerEmail}</p>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{characters}</td>
        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
          {formatDate(story.created_at)}
        </td>
        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
          <Link
            href={`/admin/workbench?storyId=${encodeURIComponent(story.id)}`}
            className="whitespace-nowrap rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            View in workbench
          </Link>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={5} className="border-t border-nav-border bg-muted/20 px-4 py-4">
            <div className="space-y-3">
              <PromptBlock label="System Prompt" content={params?.system_prompt ?? "(not stored)"} />
              <PromptBlock label="User Prompt" content={params?.user_prompt ?? "(not stored)"} />

              {params?.character_anchor && (
                <PromptBlock label="Character Anchor" content={params.character_anchor} />
              )}

              {params?.visuals_prompt && (
                <PromptBlock label="Visuals Extraction (Haiku)" content={params.visuals_prompt} />
              )}

              {params?.image_prompts && params.image_prompts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Image Prompts ({params.image_prompts.length} pages)
                  </p>
                  {params.image_prompts.map((prompt, i) => (
                    <PromptBlock key={i} label={`Page ${i + 1}`} content={prompt} />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
                <span>Story: <code className="font-mono">{params?.model || "—"}</code></span>
                {params?.visuals_prompt && (
                  <span>Visuals: <code className="font-mono">{params?.visuals_model ?? "claude-sonnet-4-6"}</code></span>
                )}
                {params?.image_model && (
                  <span>Images: <code className="font-mono">{params.image_model}</code></span>
                )}
                <span>ID: <code className="font-mono">{story.id}</code></span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── PromptViewer ─────────────────────────────────────────────────────────────

function compareRows(a: PromptLogRow, b: PromptLogRow, key: SortKey): number {
  if (key === "created_at") {
    return new Date(a.story.created_at).getTime() - new Date(b.story.created_at).getTime()
  }
  if (key === "title") {
    return a.story.title.localeCompare(b.story.title, undefined, { sensitivity: "base" })
  }
  return a.ownerName.localeCompare(b.ownerName, undefined, { sensitivity: "base" })
}

export default function PromptViewer({ rows }: { rows: PromptLogRow[] }) {
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? rows.filter(
          (row) =>
            row.story.title.toLowerCase().includes(q) ||
            row.ownerName.toLowerCase().includes(q) ||
            (row.ownerEmail?.toLowerCase().includes(q) ?? false),
        )
      : rows
    const sorted = [...matched].sort((a, b) => compareRows(a, b, sortKey))
    if (sortDir === "desc") sorted.reverse()
    return sorted
  }, [rows, query, sortKey, sortDir])

  useEffect(() => {
    setPage(1)
  }, [query, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-nav-border bg-white p-6 text-sm text-muted-foreground">
        No stories generated yet.
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by story title or owner…"
        className="w-full max-w-sm rounded-lg border border-nav-border bg-white px-3 py-2 text-sm outline-none focus:border-genie-purple-400"
      />

      {visible.length === 0 ? (
        <div className="rounded-lg border border-nav-border bg-white p-6 text-sm text-muted-foreground">
          No stories match your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-nav-border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-nav-border bg-nav-bg text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {COLUMNS.map(({ key, label }, i) => (
                  <th key={key ?? `col-${i}`} className="px-4 py-3">
                    {key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                      >
                        <span>{label}</span>
                        <span className="text-[10px]">
                          {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nav-border">
              {visible.map((row) => (
                <StoryRow key={row.story.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        total={filtered.length}
        onPageChange={setPage}
      />
    </div>
  )
}

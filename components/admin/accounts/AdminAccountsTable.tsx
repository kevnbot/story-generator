"use client"

import { useEffect, useMemo, useState } from "react"
import { Pagination } from "@/components/admin/Pagination"

const PAGE_SIZE = 25

export type AdminAccountRow = {
  accountId: string
  accountName: string
  plan: string
  ownerName: string
  ownerEmail: string | null
  wishes: number
  subscriptionPlan: string | null
  subscriptionStatus: string | null
  characterCount: number
  storyCount: number
}

type SortKey = "accountName" | "ownerName" | "wishes" | "subscriptionStatus" | "characterCount" | "storyCount"
type SortDir = "asc" | "desc"

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "accountName", label: "Account", numeric: false },
  { key: "ownerName", label: "Owner", numeric: false },
  { key: "wishes", label: "Wishes", numeric: true },
  { key: "subscriptionStatus", label: "Subscription", numeric: false },
  { key: "characterCount", label: "Characters", numeric: true },
  { key: "storyCount", label: "Stories", numeric: true },
]

function compare(a: AdminAccountRow, b: AdminAccountRow, key: SortKey): number {
  const av = a[key]
  const bv = b[key]
  if (typeof av === "number" && typeof bv === "number") return av - bv
  return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { sensitivity: "base" })
}

export function AdminAccountsTable({ rows }: { rows: AdminAccountRow[] }) {
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("storyCount")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? rows.filter(
          (row) =>
            row.accountName.toLowerCase().includes(q) ||
            row.ownerName.toLowerCase().includes(q),
        )
      : rows
    const sorted = [...matched].sort((a, b) => compare(a, b, sortKey))
    if (sortDir === "desc") sorted.reverse()
    return sorted
  }, [rows, query, sortKey, sortDir])

  useEffect(() => {
    setPage(1)
  }, [query, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by account or owner name…"
        className="w-full max-w-sm rounded-lg border border-nav-border bg-white px-3 py-2 text-sm outline-none focus:border-genie-purple-400"
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-nav-border bg-white p-6 text-sm text-muted-foreground">
          {rows.length === 0 ? "No accounts found." : "No accounts match your search."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-nav-border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-nav-border bg-nav-bg text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {COLUMNS.map(({ key, label, numeric }) => (
                  <th
                    key={key}
                    className={`px-4 py-3 ${numeric ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground ${
                        numeric ? "flex-row-reverse" : ""
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px]">
                        {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nav-border">
              {visible.map((row) => (
                <tr key={row.accountId} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.accountName}</p>
                    <p className="text-xs capitalize text-muted-foreground">{row.plan} plan</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{row.accountId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.ownerName}</p>
                    {row.ownerEmail && row.ownerEmail !== row.ownerName && (
                      <p className="text-xs text-muted-foreground">{row.ownerEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-genie-gold-800">
                    {row.wishes}
                  </td>
                  <td className="px-4 py-3">
                    {row.subscriptionStatus ? (
                      <>
                        <p className="font-medium capitalize text-foreground">{row.subscriptionPlan}</p>
                        <p className="text-xs capitalize text-muted-foreground">{row.subscriptionStatus}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">None</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{row.characterCount}</td>
                  <td className="px-4 py-3 text-right">{row.storyCount}</td>
                </tr>
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

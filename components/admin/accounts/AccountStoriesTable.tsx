"use client"

import { useState } from "react"
import Link from "next/link"
import { Pagination } from "@/components/admin/Pagination"

const PAGE_SIZE = 10

export type AccountStoryRow = {
  id: string
  title: string
  has_images: boolean
  created_at: string
  characterName: string | null
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export function AccountStoriesTable({ stories }: { stories: AccountStoryRow[] }) {
  const [page, setPage] = useState(1)

  if (stories.length === 0) {
    return (
      <div className="rounded-lg border border-nav-border bg-white p-6 text-sm text-muted-foreground">
        No stories created.
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(stories.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = stories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-nav-border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-nav-border bg-nav-bg text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Story</th>
              <th className="px-4 py-3">Character</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-nav-border">
            {visible.map((story) => (
              <tr key={story.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{story.title}</p>
                  {story.has_images && (
                    <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      images
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{story.characterName ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatDate(story.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      href={`/library/${encodeURIComponent(story.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    >
                      View story
                    </Link>
                    <Link
                      href={`/admin/workbench?storyId=${encodeURIComponent(story.id)}`}
                      className="whitespace-nowrap rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    >
                      View in workbench
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        total={stories.length}
        onPageChange={setPage}
      />
    </div>
  )
}

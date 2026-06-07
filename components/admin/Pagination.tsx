"use client"

export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null

  const buttonClass =
    "rounded-lg border border-nav-border bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-nav-bg disabled:cursor-not-allowed disabled:opacity-40"

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">
        {total} results · page {page} of {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

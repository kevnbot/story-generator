"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Story, StoryImage } from "@/types"

// ─── Page model ───────────────────────────────────────────────────────────────

interface Page {
  text: string
  image: StoryImage | null
}

// Matches lines like: ---**Page 2**, **Page 2**, --- Page 2 ---, etc.
const PAGE_BREAK_RE = /^[-–—*\s]*(?:\*{0,2})\s*Page\s+\d+\s*(?:\*{0,2})[-–—*\s]*$/i

// If the content contains explicit page-break markers, split on them and
// return the cleaned sections. Returns null if no markers are found.
function splitByPageBreaks(content: string): string[] | null {
  const lines = content.split("\n")
  const sections: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (PAGE_BREAK_RE.test(line)) {
      const section = current.join("\n").trim()
      if (section) sections.push(section)
      current = []
    } else {
      current.push(line)
    }
  }
  const last = current.join("\n").trim()
  if (last) sections.push(last)

  return sections.length > 1 ? sections : null
}

// Split story content into pages.
// Priority: explicit page-break markers → image count distribution → paragraph pairs.
function buildPages(content: string, images: StoryImage[]): Page[] {
  const sorted = [...images].sort((a, b) => a.scene_index - b.scene_index)

  // Use explicit page breaks when present — images matched by position
  const sections = splitByPageBreaks(content)
  if (sections) {
    return sections.map((text, i) => ({ text, image: sorted[i] ?? null }))
  }

  // Fallback: distribute paragraphs across image count (or pair them up)
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (sorted.length === 0) {
    const result: Page[] = []
    for (let i = 0; i < paragraphs.length; i += 2) {
      result.push({ text: paragraphs.slice(i, i + 2).join("\n\n"), image: null })
    }
    return result.length > 0 ? result : [{ text: content.trim(), image: null }]
  }

  const perPage = Math.ceil(paragraphs.length / sorted.length)
  return sorted.map((img, i) => ({
    text: paragraphs.slice(i * perPage, (i + 1) * perPage).join("\n\n"),
    image: img,
  }))
}

// ─── Page sub-components ──────────────────────────────────────────────────────

function TitlePage({ story, dateLabel }: { story: Story; dateLabel: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="text-5xl" aria-hidden="true">📖</span>
      <h1 className="font-serif text-3xl font-bold leading-snug" style={{ color: "#2d1f0e" }}>
        {story.title}
      </h1>
      <div className="h-px w-14" style={{ background: "#c4a882" }} />
      <p className="text-sm" style={{ color: "#8a6f4e" }}>{dateLabel}</p>
    </div>
  )
}

function ImagePage({ page }: { page: Page }) {
  return (
    <div className="flex h-full flex-col">
      {/* Image — top 60% */}
      <div className="flex-[3] overflow-hidden">
        <img
          src={page.image!.url}
          alt={page.image!.caption ?? ""}
          className="h-full w-full object-cover"
        />
      </div>
      {/* Text — bottom 40% */}
      <div
        className="flex flex-[2] items-center justify-center overflow-y-auto px-6 py-5"
        style={{ background: "#fdf8f0" }}
      >
        <p
          className="font-serif text-sm leading-relaxed text-center"
          style={{ color: "#2d1f0e" }}
        >
          {page.text}
        </p>
      </div>
    </div>
  )
}

function TextPage({ page }: { page: Page }) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-8 py-6">
      <p
        className="font-serif text-lg leading-relaxed text-center"
        style={{ color: "#2d1f0e" }}
      >
        {page.text}
      </p>
    </div>
  )
}

// ─── BookReader ───────────────────────────────────────────────────────────────

export default function BookReader({ story }: { story: Story }) {
  const pages = buildPages(story.content, story.images ?? [])
  const total = pages.length + 1 // 0 = title, 1..n = content
  const [current, setCurrent] = useState(0)

  const prev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setCurrent((i) => Math.min(total - 1, i + 1)), [total])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [prev, next])

  const isTitle = current === 0
  const page = isTitle ? null : pages[current - 1]

  const dateLabel = new Date(story.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <>
      {/* ── Interactive reader (hidden when printing) ── */}
      <div id="book-reader" className="flex flex-col items-center gap-6 py-4">
        {/* Book */}
        <div
          className="relative w-full max-w-[480px] overflow-hidden rounded-2xl"
          style={{
            aspectRatio: "3/4",
            background: "#fdf8f0",
            boxShadow: "0 10px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {/* Page content — keyed so each page mounts fresh and triggers the fade */}
          <div key={current} className="book-page-anim h-full">
            {isTitle ? (
              <TitlePage story={story} dateLabel={dateLabel} />
            ) : page?.image ? (
              <ImagePage page={page} />
            ) : (
              <TextPage page={page!} />
            )}
          </div>

          {/* Page number */}
          <p
            className="pointer-events-none absolute bottom-2.5 left-0 right-0 select-none text-center text-[10px]"
            style={{ color: "#c4a882" }}
          >
            {current + 1}
          </p>

          {/* Corner curl */}
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-8 w-8"
            style={{ background: "linear-gradient(225deg, #ddd0b8 45%, transparent 45%)" }}
            aria-hidden="true"
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-5">
          <button
            onClick={prev}
            disabled={current === 0}
            aria-label="Previous page"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <span className="w-20 text-center text-sm tabular-nums text-muted-foreground">
            {current + 1} / {total}
          </span>

          <button
            onClick={next}
            disabled={current === total - 1}
            aria-label="Next page"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Download PDF */}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {/* ── Print layout (hidden on screen, rendered when printing) ── */}
      <div id="print-layout">
        {/* Title page */}
        <div className="print-page">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1.5rem", textAlign: "center", padding: "3rem", background: "#fdf8f0" }}>
            <div style={{ fontSize: "4rem" }}>📖</div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "2.5rem", fontWeight: "bold", color: "#2d1f0e", lineHeight: 1.2, margin: 0 }}>
              {story.title}
            </h1>
            <div style={{ width: "4rem", height: "1px", background: "#c4a882" }} />
            <p style={{ fontFamily: "Georgia, serif", fontSize: "1rem", color: "#8a6f4e", margin: 0 }}>
              {dateLabel}
            </p>
          </div>
        </div>

        {/* Content pages */}
        {pages.map((p, i) => (
          <div key={i} className="print-page" style={{ background: "#fdf8f0" }}>
            {p.image && (
              <img
                src={p.image.url}
                alt={p.image.caption ?? ""}
                style={{ width: "100%", height: "60%", objectFit: "cover", display: "block" }}
              />
            )}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem 2.5rem" }}>
              <p style={{ fontFamily: "Georgia, serif", fontSize: "1.15rem", lineHeight: 1.85, color: "#2d1f0e", textAlign: "center", margin: 0 }}>
                {p.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes bookPageIn {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .book-page-anim { animation: bookPageIn 0.2s ease-out; }

        #print-layout { display: none; }

        @media print {
          body * { visibility: hidden; }
          #print-layout,
          #print-layout * { visibility: visible; }
          #print-layout {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          .print-page {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
          }
        }
      `}</style>
    </>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, Download, BookOpen, X, Share2 } from "lucide-react"
import { Story, StoryImage } from "@/types"
import PromptModal from "./PromptModal"
import ShareModal from "./ShareModal"

const STORY_IMAGE_ERROR_PATH = "/images/story-image-error.svg"

// Pick a print font size so each page's text fits alongside its image.
// (Pure CSS can't auto-fit arbitrary-length text to a fixed-height box.)
function printFontSize(len: number): string {
  if (len > 1100) return "0.78rem"
  if (len > 900) return "0.85rem"
  if (len > 700) return "0.95rem"
  if (len > 500) return "1.0rem"
  if (len > 350) return "1.08rem"
  return "1.15rem"
}

// ─── Page model ───────────────────────────────────────────────────────────────

interface Page {
  text: string
  image: StoryImageWithUrl | null
}

interface StoryImageWithUrl extends StoryImage {
  url: string
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
  const sorted = [...images]
    .filter((image): image is StoryImageWithUrl => Boolean(image.url))
    .sort((a, b) => a.scene_index - b.scene_index)

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

function TitlePage({
  story,
  dateLabel,
  showCtas,
  onStoryMode,
  onNextPage,
}: {
  story: Story
  dateLabel: string
  showCtas: boolean
  onStoryMode: () => void
  onNextPage: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-10 py-14 text-center">
      <span className="text-6xl drop-shadow-sm" aria-hidden="true">📖</span>
      <h1 className="font-serif text-4xl font-bold leading-snug" style={{ color: "#2d1f0e" }}>
        {story.title}
      </h1>
      <div className="h-px w-16" style={{ background: "#c4a882" }} />
      <p className="text-sm uppercase tracking-[0.2em]" style={{ color: "#8a6f4e" }}>{dateLabel}</p>

      {showCtas && (
        <div className="mt-3 flex w-full max-w-[280px] flex-col items-stretch gap-3">
          <button
            onClick={onStoryMode}
            className="flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
          >
            <BookOpen className="h-5 w-5" />
            Story Mode
          </button>
          <button
            onClick={onNextPage}
            className="flex items-center justify-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-medium transition-colors"
            style={{ color: "#8a6f4e" }}
          >
            Next page
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// Fullscreen, edge-to-edge reading layout used in Story Mode.
// >800px: image left / text right. ≤800px: image top / text below.
// The image is pinned; only the text panel scrolls.
function StoryModePage({ page }: { page: Page }) {
  const hasImage = Boolean(page.image)
  const isErrorPlaceholder = hasImage && page.image!.url === STORY_IMAGE_ERROR_PATH
  return (
    <div className="flex h-full w-full flex-col min-[801px]:flex-row" style={{ background: "#fdf8f0" }}>
      {hasImage && (
        <div className="relative shrink-0 overflow-hidden min-[801px]:h-full min-[801px]:w-1/2 min-[801px]:shrink">
          <img
            src={page.image!.url}
            alt={isErrorPlaceholder ? "" : (page.image!.caption ?? "")}
            className="aspect-[4/3] h-full w-full object-contain min-[801px]:aspect-auto"
          />
        </div>
      )}
      <div
        className={`reader-scroll min-h-0 flex-1 overflow-y-auto px-8 pb-28 pt-10 ${
          hasImage ? "min-[801px]:w-1/2" : "w-full"
        }`}
      >
        {isErrorPlaceholder && (
          <p className="mb-3 text-center text-xs text-muted-foreground">
            We had trouble creating this illustration
          </p>
        )}
        <p
          className="mx-auto max-w-prose text-center font-serif text-lg leading-relaxed sm:text-xl"
          style={{ color: "#2d1f0e" }}
        >
          {page.text}
        </p>
      </div>
    </div>
  )
}

function ImagePage({ page }: { page: Page }) {
  const isErrorPlaceholder = page.image!.url === STORY_IMAGE_ERROR_PATH
  return (
    // Image stays pinned at the top; only the text panel below it scrolls.
    <div className="flex h-full flex-col">
      <div className="relative shrink-0">
        {/* Image at its natural landscape 4:3 ratio — no cropping */}
        <div className="aspect-[4/3] w-full overflow-hidden">
          <img
            src={page.image!.url}
            alt={isErrorPlaceholder ? "" : (page.image!.caption ?? "")}
            className="h-full w-full object-cover"
          />
        </div>
        {/* Soft fade so the illustration melts into the page */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
          style={{ background: "linear-gradient(to top, #fdf8f0, rgba(253,248,240,0))" }}
          aria-hidden="true"
        />
      </div>
      {/* Scrollable text panel */}
      <div className="reader-scroll min-h-0 flex-1 overflow-y-auto px-8 pb-16 pt-3" style={{ background: "#fdf8f0" }}>
        {isErrorPlaceholder && (
          <p className="mb-3 text-center text-xs text-muted-foreground">
            We had trouble creating this illustration
          </p>
        )}
        <p
          className="mx-auto max-w-prose text-center font-serif text-base leading-relaxed sm:text-lg"
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
    <div className="reader-scroll flex h-full min-h-0 flex-col overflow-y-auto px-8 py-12">
      <p
        className="m-auto max-w-prose text-center font-serif text-lg leading-relaxed sm:text-xl"
        style={{ color: "#2d1f0e" }}
      >
        {page.text}
      </p>
    </div>
  )
}

// Bottom-center page navigation: prev · dots · next.
function NavPill({
  current,
  total,
  onPrev,
  onNext,
  onJump,
}: {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  onJump: (i: number) => void
}) {
  return (
    <div className="flex max-w-[92vw] items-center gap-3 rounded-full border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
      <button
        onClick={onPrev}
        disabled={current === 0}
        aria-label="Previous page"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 disabled:opacity-30"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div
        className="flex max-w-[60vw] items-center gap-1.5 overflow-x-auto px-1"
        aria-label={`Page ${current + 1} of ${total}`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to page ${i + 1}`}
            className="h-2 shrink-0 rounded-full transition-all"
            style={{
              width: i === current ? "1.5rem" : "0.5rem",
              background: i === current ? "#ffffff" : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={current === total - 1}
        aria-label="Next page"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 disabled:opacity-30"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

// ─── BookReader ───────────────────────────────────────────────────────────────

export default function BookReader({
  story,
  initialPage,
  initialStoryMode,
  canShare = false,
  publicView = false,
}: {
  story: Story
  initialPage: number
  initialStoryMode: boolean
  canShare?: boolean
  publicView?: boolean
}) {
  const pages = buildPages(story.content, story.images ?? [])
  const total = pages.length + 1 // 0 = title, 1..n = content
  const hasContent = total > 1
  const pathname = usePathname()

  const [current, setCurrent] = useState(() => {
    const clamped = Math.min(Math.max(0, initialPage), total - 1)
    // Story mode is never valid on the title page — start at the first content page.
    if (initialStoryMode && clamped === 0 && hasContent) return 1
    return clamped
  })
  const [storyMode, setStoryMode] = useState(() => initialStoryMode && hasContent)
  const [showPrompts, setShowPrompts] = useState(false)
  const [showShare, setShowShare] = useState(false)
  // Portal target (document.body) only exists on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Ensure every print image is decoded before opening the print dialog,
  // otherwise the first print can capture blank images from the hidden layout.
  const handleDownload = useCallback(async () => {
    const root = document.getElementById("print-layout")
    if (root) {
      const imgs = Array.from(root.querySelectorAll("img"))
      await Promise.all(imgs.map((img) => img.decode().catch(() => {})))
    }
    window.print()
  }, [])

  const prev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setCurrent((i) => Math.min(total - 1, i + 1)), [total])

  // Title CTA: enter immersive mode at the first content page.
  const startStoryMode = useCallback(() => {
    setStoryMode(true)
    setCurrent(1)
  }, [])
  // Top-bar button: enter immersive mode on the current page (bump off the title).
  const enterStoryMode = useCallback(() => {
    setStoryMode(true)
    setCurrent((i) => (i === 0 ? 1 : i))
  }, [])
  const exitStoryMode = useCallback(() => setStoryMode(false), [])
  // Title CTA: read normally without entering story mode.
  const goNextPageReadMode = useCallback(() => setCurrent(1), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
      if (e.key === "Escape" && storyMode) exitStoryMode()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [prev, next, storyMode, exitStoryMode])

  // Keep mode/page in the URL without triggering a server refetch (no router nav).
  useEffect(() => {
    const sp = new URLSearchParams()
    if (storyMode) sp.set("mode", "story")
    if (current > 0) sp.set("page", String(current))
    const qs = sp.toString()
    window.history.replaceState(window.history.state, "", qs ? `${pathname}?${qs}` : pathname)
  }, [current, storyMode, pathname])

  const isTitle = current === 0
  const page = isTitle ? null : pages[current - 1]

  const dateLabel = new Date(story.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <>
      {storyMode && page ? (
        /* ── Story Mode: fullscreen viewport takeover ── */
        <div className="no-print fixed inset-0 z-40" style={{ background: "#fdf8f0" }}>
          {/* Keyed so each page mounts fresh and triggers the fade */}
          <div key={current} className="book-page-anim absolute inset-0">
            <StoryModePage page={page} />
          </div>

          {/* Bottom controls: nav pill + exit */}
          <div className="absolute bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3">
            <NavPill current={current} total={total} onPrev={prev} onNext={next} onJump={setCurrent} />
            <button
              onClick={exitStoryMode}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Exit story mode
            </button>
          </div>
        </div>
      ) : (
        /* ── Read Mode: cozy centered book card ── */
        <div
          id="book-reader"
          className="absolute inset-0 flex items-center justify-center px-4 py-4 sm:px-6 sm:py-6"
        >
          {/* Ambient glow behind the book */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[70%] w-[70%] max-w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
            style={{ background: "radial-gradient(circle, rgba(167,139,250,0.30), transparent 70%)" }}
            aria-hidden="true"
          />

          {/* Top bar: Library/brand · Publish & share · Story Mode · Download */}
          <div className="no-print absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3">
            {publicView ? (
              <Link
                href="/"
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                ✦ My Genie Stories
              </Link>
            ) : (
              <Link
                href="/library"
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                ← Library
              </Link>
            )}
            <div className="flex items-center gap-2">
              {canShare && !publicView && (
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Publish &amp; share</span>
                </button>
              )}
              {current > 0 && hasContent && (
                <button
                  onClick={enterStoryMode}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Story Mode</span>
                </button>
              )}
              {!publicView && (
                <button
                  onClick={handleDownload}
                  aria-label="Download PDF"
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Book card */}
          <div
            className="relative z-10 flex h-full max-h-[920px] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl ring-1 ring-white/10"
            style={{
              background: "#fdf8f0",
              boxShadow: "0 24px 80px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)",
            }}
          >
            {/* Page content — keyed so each page mounts fresh and triggers the fade */}
            <div key={current} className="book-page-anim min-h-0 flex-1">
              {isTitle ? (
                <TitlePage
                  story={story}
                  dateLabel={dateLabel}
                  showCtas={hasContent}
                  onStoryMode={startStoryMode}
                  onNextPage={goNextPageReadMode}
                />
              ) : page?.image ? (
                <ImagePage page={page} />
              ) : (
                <TextPage page={page!} />
              )}
            </div>

            {/* Corner curl */}
            <div
              className="pointer-events-none absolute bottom-0 right-0 z-10 h-8 w-8"
              style={{ background: "linear-gradient(225deg, #ddd0b8 45%, transparent 45%)" }}
              aria-hidden="true"
            />
          </div>

          {/* Bottom nav pill (content pages only — hidden on the title cover) */}
          {current > 0 && (
            <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
              <NavPill current={current} total={total} onPrev={prev} onNext={next} onJump={setCurrent} />
            </div>
          )}
        </div>
      )}

      {showPrompts && story.generation_params && (
        <PromptModal
          params={story.generation_params}
          onClose={() => setShowPrompts(false)}
        />
      )}

      {showShare && canShare && !publicView && (
        <ShareModal
          storyId={story.id}
          isPublished={story.is_published}
          shareToken={story.share_token}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* ── Print layout — portaled to <body> so it escapes the reader's
          overflow:hidden ancestor (which otherwise clips it to one page) ── */}
      {mounted &&
        createPortal(
          <div id="print-layout">
            {/* Title page */}
            <div className="print-page">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1.5rem", textAlign: "center", padding: "3rem" }}>
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
            {pages.map((p, i) => {
              const isPrintError = p.image?.url === STORY_IMAGE_ERROR_PATH
              return (
                <div key={i} className="print-page">
                  {p.image && (
                    <img
                      className="print-img"
                      src={p.image.url}
                      alt={isPrintError ? "" : (p.image.caption ?? "")}
                    />
                  )}
                  <div className="print-text-wrap">
                    {isPrintError && (
                      <p style={{ fontFamily: "sans-serif", fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.75rem", textAlign: "center" }}>
                        We had trouble creating this illustration
                      </p>
                    )}
                    <p
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: printFontSize(p.text.length),
                        lineHeight: 1.7,
                        color: "#2d1f0e",
                        textAlign: "center",
                        maxWidth: "60ch",
                        margin: 0,
                      }}
                    >
                      {p.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>,
          document.body
        )}

      <style>{`
        @keyframes bookPageIn {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .book-page-anim { animation: bookPageIn 0.2s ease-out; }

        /* Slim, themed scrollbar for the text panel */
        .reader-scroll { scrollbar-width: thin; scrollbar-color: #d9c7a6 transparent; }
        .reader-scroll::-webkit-scrollbar { width: 8px; }
        .reader-scroll::-webkit-scrollbar-track { background: transparent; }
        .reader-scroll::-webkit-scrollbar-thumb {
          background: #d9c7a6;
          border-radius: 9999px;
          border: 2px solid #fdf8f0;
        }
        .reader-scroll::-webkit-scrollbar-thumb:hover { background: #c4a882; }

        #print-layout { display: none; }

        @media print {
          @page { size: auto; margin: 0; }
          html, body { margin: 0; padding: 0; }
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
            box-sizing: border-box;
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: #fdf8f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            break-after: page;
            page-break-after: always;
          }
          .print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .print-img {
            display: block;
            width: 100%;
            max-width: 100%;
            max-height: 50vh;
            object-fit: contain;
            margin: 0 auto;
          }
          .print-text-wrap {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1.5rem 2.5rem;
            overflow: hidden;
          }
        }
      `}</style>
    </>
  )
}

"use client"

import { useEffect, useState, useTransition } from "react"
import { X, Copy, Check, Globe, Loader2 } from "lucide-react"
import { publishStory, unpublishStory } from "@/app/actions/stories"

export default function ShareModal({
  storyId,
  isPublished,
  shareToken,
  onClose,
}: {
  storyId: string
  isPublished: boolean
  shareToken: string | null
  onClose: () => void
}) {
  const [published, setPublished] = useState(isPublished)
  const [token, setToken] = useState<string | null>(shareToken)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${token}`
      : ""

  function handlePublish() {
    setError(null)
    startTransition(async () => {
      const res = await publishStory(storyId)
      if (res.error) {
        setError(res.error)
      } else {
        setToken(res.token ?? null)
        setPublished(true)
      }
    })
  }

  function handleUnpublish() {
    setError(null)
    startTransition(async () => {
      const res = await unpublishStory(storyId)
      if (res.error) setError(res.error)
      else setPublished(false)
    })
  }

  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const isLive = published && Boolean(token)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-background p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Globe className="h-4 w-4" />
            Publish &amp; share
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLive ? (
          <>
            <p className="text-sm text-muted-foreground">
              This story is published. Anyone with the link below can read it — no account needed.
            </p>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-1 text-xs text-foreground outline-none"
              />
              <button
                onClick={copyLink}
                className="flex shrink-0 items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              onClick={handleUnpublish}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Stop sharing
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Publishing creates a private link you can send to anyone. They&apos;ll be able to read
              the full story — including the illustrations and your child&apos;s name — without
              logging in. Only people with the link can see it, and you can stop sharing at any time.
            </p>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              onClick={handlePublish}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Publish &amp; get link
            </button>
          </>
        )}
      </div>
    </div>
  )
}

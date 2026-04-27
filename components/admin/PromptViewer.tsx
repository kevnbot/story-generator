"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react"
import { Story } from "@/types"

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
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

// ─── StoryPromptCard ──────────────────────────────────────────────────────────

function StoryPromptCard({ story }: { story: Story }) {
  const [open, setOpen] = useState(false)
  const params = story.generation_params
  const kidNames = params?.kid_names?.join(", ") ?? "—"
  const dateLabel = new Date(story.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="flex-1 font-medium text-foreground truncate">{story.title}</span>
        <span className="shrink-0 text-[12px] text-muted-foreground">{kidNames}</span>
        {story.has_images && (
          <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            images
          </span>
        )}
        <span className="shrink-0 text-[12px] text-muted-foreground">{dateLabel}</span>
      </button>

      {/* Prompt sections */}
      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          <PromptBlock label="System Prompt" content={params?.system_prompt ?? "(not stored)"} />
          <PromptBlock label="User Prompt" content={params?.user_prompt ?? "(not stored)"} />

          {params?.character_anchor && (
            <PromptBlock label="Character Anchor" content={params.character_anchor} />
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
            <span>Story model: <code className="font-mono">{params?.model || "—"}</code></span>
            <span>Image model: <code className="font-mono">{params?.image_model || "—"}</code></span>
            <span>Story ID: <code className="font-mono">{story.id}</code></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PromptViewer ─────────────────────────────────────────────────────────────

export default function PromptViewer({ stories }: { stories: Story[] }) {
  if (stories.length === 0) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        No stories generated yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {stories.map((story) => (
        <StoryPromptCard key={story.id} story={story} />
      ))}
    </div>
  )
}

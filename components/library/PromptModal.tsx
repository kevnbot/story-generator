"use client"

import { useEffect, useState } from "react"
import { X, Copy, Check } from "lucide-react"
import type { GenerationParams } from "@/types"

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

export default function PromptModal({
  params,
  onClose,
}: {
  params: GenerationParams
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-background border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Generation Prompts</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <PromptBlock label="System Prompt" content={params.system_prompt ?? "(not stored)"} />
        <PromptBlock label="User Prompt" content={params.user_prompt ?? "(not stored)"} />

        {params.character_anchor && (
          <PromptBlock label="Character Anchor" content={params.character_anchor} />
        )}

        {params.visuals_prompt && (
          <PromptBlock label="Visuals Extraction (Haiku)" content={params.visuals_prompt} />
        )}

        {params.image_prompts && params.image_prompts.length > 0 && (
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
          <span>Story: <code className="font-mono">{params.model || "—"}</code></span>
          {params.visuals_prompt && (
            <span>Visuals: <code className="font-mono">claude-haiku-4-5-20251001</code></span>
          )}
          {params.image_model && (
            <span>Images: <code className="font-mono">{params.image_model}</code></span>
          )}
        </div>
      </div>
    </div>
  )
}

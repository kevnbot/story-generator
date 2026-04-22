"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { deleteStory } from "@/app/actions/stories"

interface Story {
  id: string
  title: string
  content: string
  has_images: boolean
  version_number: number
  parent_story_id: string | null
  credits_used: number
  created_at: string
  generation_params: {
    kid_names?: string[]
    kid_profile_ids?: string[]
    story_template_id?: string
  }
}

interface StoryGroup {
  root: Story
  versions: Story[]
}

function groupStories(stories: Story[]): StoryGroup[] {
  const roots = stories.filter(s => !s.parent_story_id)
  const byParent = new Map<string, Story[]>()

  for (const s of stories) {
    if (!s.parent_story_id) continue
    const arr = byParent.get(s.parent_story_id) ?? []
    arr.push(s)
    byParent.set(s.parent_story_id, arr)
  }

  return roots.map(root => ({
    root,
    versions: (byParent.get(root.id) ?? []).sort((a, b) => a.version_number - b.version_number),
  }))
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function StoryCard({ story, isVersion = false, onDelete }: {
  story: Story
  isVersion?: boolean
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const kidNames = story.generation_params?.kid_names?.join(", ") ?? ""

  return (
    <div className={`rounded-xl border bg-card ${isVersion ? "ml-6 border-dashed" : ""}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{story.title}</span>
              {story.version_number > 1 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  v{story.version_number}
                </span>
              )}
              {story.has_images && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  + images
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {kidNames && <span>{kidNames} · </span>}
              {formatDate(story.created_at)}
              {story.credits_used > 0 && <span> · {story.credits_used} credit{story.credits_used !== 1 ? "s" : ""}</span>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(v => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Hide" : "Read"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(story.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </div>

        {!expanded && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {story.content.slice(0, 160)}…
          </p>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t pt-4">
          <div className="prose prose-sm max-w-none leading-relaxed whitespace-pre-wrap text-foreground max-h-[60vh] overflow-y-auto">
            {story.content}
          </div>
          {story.has_images && story.generation_params && (
            <p className="text-xs text-muted-foreground mt-3">This version includes AI-generated images.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function StoriesClient({ stories }: { stories: Story[] }) {
  const [pending, startTransition] = useTransition()
  const groups = groupStories(stories)

  const handleDelete = (id: string) => {
    startTransition(async () => { await deleteStory(id) })
  }

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="text-6xl">📚</div>
        <h1 className="text-3xl font-bold">My Stories</h1>
        <p className="text-muted-foreground max-w-md">
          Your generated stories will appear here. Generate your first story to get started!
        </p>
        <Button asChild>
          <a href="/generate">Generate a Story</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">My Stories</h1>

      <div className="space-y-6">
        {groups.map(({ root, versions }) => (
          <div key={root.id} className="space-y-2">
            <StoryCard story={root} onDelete={handleDelete} />

            {versions.map(v => (
              <StoryCard key={v.id} story={v} isVersion onDelete={handleDelete} />
            ))}

            <div className="flex items-center gap-2 pl-1">
              <Button variant="outline" size="sm" asChild>
                <a href={`/generate?parentStoryId=${root.id}`}>
                  + New Version
                </a>
              </Button>
              {versions.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {versions.length} version{versions.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Story } from "@/types"
import BookReader from "@/components/library/BookReader"

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ storyId: string }>
}) {
  const { storyId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: story } = await supabase
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .is("deleted_at", null)
    .single()

  if (!story) notFound()

  return (
    <div className="mx-auto max-w-xl px-4">
      <div className="no-print mb-2 flex items-center justify-between">
        <Link
          href="/library"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Library
        </Link>
        <Link
          href={`/generate?parentStoryId=${story.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          + New version
        </Link>
      </div>

      <BookReader story={story as Story} />
    </div>
  )
}

import Link from "next/link"

export default async function StoryReaderLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ storyId: string }>
}) {
  const { storyId } = await params

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1c0f35" }}>
      <nav
        className="no-print flex shrink-0 items-center justify-between px-5 py-3"
        style={{ background: "#150b28" }}
      >
        <Link
          href="/library"
          className="text-sm text-white/60 transition-colors hover:text-white"
        >
          ← Library
        </Link>
        <Link
          href={`/generate?parentStoryId=${storyId}`}
          className="text-sm text-white/60 transition-colors hover:text-white"
        >
          + New version
        </Link>
      </nav>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

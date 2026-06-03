import Link from "next/link"

export default function StoryReaderLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
      </nav>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

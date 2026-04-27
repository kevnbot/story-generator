"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/generate", label: "Generate", icon: "✨" },
  { href: "/library", label: "My Stories", icon: "📚" },
  { href: "/profiles", label: "Profiles", icon: "👧" },
  { href: "/admin", label: "Admin", icon: "⚙️" },
]

export function Nav({
  userName,
  credits,
}: {
  userName: string | null
  credits: number
}) {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/generate" className="flex items-center gap-2 font-semibold text-brand-700 shrink-0">
          <span>📖</span>
          <span className="hidden sm:inline">Story Generator</span>
        </Link>
        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:block">
            <span className="font-semibold text-foreground">{credits}</span> credits
          </span>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}

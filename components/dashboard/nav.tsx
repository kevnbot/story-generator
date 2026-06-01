"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { logout } from "@/app/actions/auth"

const tabs = [
  { href: "/generate", label: "Create", icon: "✦" },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/profiles", label: "Profile", icon: "👤" },
  { href: "/account/billing", label: "Billing", icon: "💳" },
]

export function Nav({
  credits,
  isAdmin,
}: {
  userName: string | null
  credits: number
  isAdmin: boolean
}) {
  const pathname = usePathname()

  return (
    <>
      {/* ── Top nav bar ── */}
      <header
        className="sticky top-0 z-10"
        style={{ backgroundColor: "#fff7ed", borderBottom: "0.5px solid #f0d9c0" }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/generate" className="flex items-center gap-2 shrink-0">
            <span style={{ color: "#d97706", fontSize: "18px", fontWeight: 600 }}>✦</span>
            <span style={{ color: "#6d28d9", fontSize: "15px", fontWeight: 600 }}>
              My Genie Stories
            </span>
          </Link>

          {/* Desktop inline tab links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {tabs.map(({ href, label, icon }) => {
              const isActive = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? "#7c3aed" : "#a78bfa",
                    backgroundColor: isActive ? "#f5f0ff" : "transparent",
                  }}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "#a78bfa" }}
              >
                <span>🛠️</span>
                <span>Admin</span>
              </Link>
            )}
          </nav>

          {/* Right side: wishes pill + sign out */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Wishes pill */}
            <div
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: "#fef3c7",
                border: "1px solid #fbbf24",
                color: "#92400e",
              }}
            >
              <span>✦</span>
              <span>{credits} wishes</span>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Bottom tab bar — mobile only ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-10 flex"
        style={{
          backgroundColor: "#fff7ed",
          borderTop: "0.5px solid #f0d9c0",
          height: "56px",
        }}
      >
        {tabs.map(({ href, label, icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{ color: isActive ? "#7c3aed" : "#c4b5fd" }}
            >
              <span style={{ fontSize: "18px", lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.3px" }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { logout } from "@/app/actions/auth"

// Tabs that stay inline in the top nav.
const primaryTabs = [
  { href: "/generate", label: "Create", icon: "✦" },
  { href: "/library", label: "Library", icon: "📚" },
]

// Tabs that live in the avatar dropdown.
const menuTabs = [
  { href: "/generate", label: "Create", icon: "✦" },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/profiles", label: "Profile", icon: "👤" },
  { href: "/account/billing", label: "Billing", icon: "💳" },
]

function initials(name: string | null) {
  if (!name) return "👤"
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("")
  return letters || "👤"
}

// Magical wishes pill. Resting state shows the current balance; on hover the
// pill glows, the stars twinkle, a small sparkle burst pops, and the label
// morphs to "Add wishes" — linking to the plans page. Inline styles override
// CSS `:hover`, so hover state is tracked in React; the keyframes (reused from
// the StoryLibrary sparkle pattern) are injected once via a <style> tag.
function WishesPill({ credits }: { credits: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href="/plans"
      aria-label={`${credits} wishes — add more`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2"
      style={{
        backgroundColor: hovered ? "#fffbeb" : "#fef3c7",
        border: `1px solid ${hovered ? "#f59e0b" : "#fbbf24"}`,
        color: "#92400e",
        boxShadow: hovered ? "0 0 0 3px #fde68a" : "none",
        transform: hovered ? "scale(1.04)" : "scale(1)",
        transition: "background-color 150ms, border-color 150ms, box-shadow 150ms, transform 150ms",
      }}
    >
      <style>{`
        @keyframes wishpill-pop {
          0%   { opacity: 0; transform: scale(0) translateY(0); }
          40%  { opacity: 1; transform: scale(1.2) translateY(-8px); }
          100% { opacity: 0; transform: scale(0.5) translateY(-16px); }
        }
        @keyframes wishpill-twinkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50%      { transform: scale(1.35) rotate(18deg); opacity: 0.7; }
        }
        .wishpill-star { display: inline-block; }
        .wishpill-spark {
          position: absolute;
          pointer-events: none;
          font-size: 9px;
          color: #f59e0b;
          opacity: 0;
        }
        .wishpill-hovered .wishpill-star { animation: wishpill-twinkle 1.1s ease-in-out infinite; }
        .wishpill-hovered .wishpill-spark-0 { animation: wishpill-pop 1.4s ease-out 0s infinite; }
        .wishpill-hovered .wishpill-spark-1 { animation: wishpill-pop 1.4s ease-out 0.5s infinite; }
        .wishpill-hovered .wishpill-spark-2 { animation: wishpill-pop 1.4s ease-out 0.9s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .wishpill-hovered .wishpill-star,
          .wishpill-hovered .wishpill-spark-0,
          .wishpill-hovered .wishpill-spark-1,
          .wishpill-hovered .wishpill-spark-2 { animation: none; }
          .wishpill-hovered .wishpill-spark { opacity: 0; }
        }
      `}</style>

      <span className={hovered ? "wishpill-hovered contents" : "contents"}>
        {/* decorative sparkle burst */}
        <span aria-hidden className="wishpill-spark wishpill-spark-0" style={{ top: "-6px", left: "10%" }}>✦</span>
        <span aria-hidden className="wishpill-spark wishpill-spark-1" style={{ top: "-4px", right: "16%" }}>✨</span>
        <span aria-hidden className="wishpill-spark wishpill-spark-2" style={{ bottom: "-6px", left: "45%" }}>✦</span>

        <span aria-hidden className="wishpill-star">{hovered ? "✨" : "✦"}</span>
        <span>{hovered ? "Add wishes" : `${credits} wishes`}</span>
      </span>
    </Link>
  )
}

// Inline top-nav link with a hover affordance. Inline styles override CSS
// `:hover`, so hover state is tracked in React.
function NavLink({
  href,
  label,
  icon,
  isActive,
}: {
  href: string
  label: string
  icon: string
  isActive: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const background = isActive
    ? "#f5f0ff"
    : hovered
      ? "#faf6ff"
      : "transparent"
  const color = isActive || hovered ? "#7c3aed" : "#a78bfa"

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
      style={{ color, backgroundColor: background }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

export function Nav({
  userName,
  credits,
  isAdmin,
}: {
  userName: string | null
  credits: number
  isAdmin: boolean
}) {
  const pathname = usePathname()
  const [avatarHover, setAvatarHover] = useState(false)

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
            {primaryTabs.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                isActive={pathname.startsWith(href)}
              />
            ))}
          </nav>

          {/* Right side: wishes pill + avatar dropdown */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Wishes pill */}
            <WishesPill credits={credits} />

            {/* Avatar dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  onMouseEnter={() => setAvatarHover(true)}
                  onMouseLeave={() => setAvatarHover(false)}
                  className="flex items-center justify-center rounded-full text-sm font-semibold transition-all outline-none focus-visible:ring-2 cursor-pointer"
                  style={{
                    width: "34px",
                    height: "34px",
                    backgroundColor: avatarHover ? "#e9ddff" : "#f5f0ff",
                    border: `1px solid ${avatarHover ? "#b89af0" : "#ddd0f5"}`,
                    color: "#6d28d9",
                    boxShadow: avatarHover ? "0 0 0 3px #f0e8ff" : "none",
                  }}
                >
                  {initials(userName)}
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[180px] rounded-xl p-1 shadow-lg"
                  style={{
                    backgroundColor: "#fff7ed",
                    border: "0.5px solid #f0d9c0",
                  }}
                >
                  {userName && (
                    <>
                      <div
                        className="px-3 py-2 text-xs font-medium truncate"
                        style={{ color: "#92400e" }}
                      >
                        {userName}
                      </div>
                      <DropdownMenu.Separator
                        className="my-1 h-px"
                        style={{ backgroundColor: "#f0d9c0" }}
                      />
                    </>
                  )}

                  {menuTabs.map(({ href, label, icon }) => (
                    <DropdownMenu.Item key={href} asChild>
                      <Link
                        href={href}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer outline-none transition-colors data-[highlighted]:bg-[#f5f0ff]"
                        style={{ color: "#7c3aed" }}
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                      </Link>
                    </DropdownMenu.Item>
                  ))}

                  {isAdmin && (
                    <DropdownMenu.Item asChild>
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer outline-none transition-colors data-[highlighted]:bg-[#f5f0ff]"
                        style={{ color: "#7c3aed" }}
                      >
                        <span>🛠️</span>
                        <span>Admin</span>
                      </Link>
                    </DropdownMenu.Item>
                  )}

                  <DropdownMenu.Separator
                    className="my-1 h-px"
                    style={{ backgroundColor: "#f0d9c0" }}
                  />

                  <DropdownMenu.Item asChild>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer outline-none transition-colors data-[highlighted]:bg-[#f5f0ff]"
                        style={{ color: "#b45309" }}
                      >
                        <span>↩</span>
                        <span>Sign out</span>
                      </button>
                    </form>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
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
        {primaryTabs.map(({ href, label, icon }) => {
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

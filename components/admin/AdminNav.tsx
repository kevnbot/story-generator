"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  { href: "/admin", label: "Prompt Log", icon: "📝", exact: true },
  { href: "/admin/workbench", label: "Prompt Workbench", icon: "🛠️" },
  { href: "/admin/billing", label: "Billing", icon: "💳" },
  { href: "/admin/accounts", label: "Accounts", icon: "👥" },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <div
      className="border-b"
      style={{ backgroundColor: "#fff7ed", borderColor: "#f0d9c0" }}
    >
      <nav className="mx-auto max-w-6xl px-4 flex items-center gap-1 overflow-x-auto">
        {tabs.map(({ href, label, icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: isActive ? "#7c3aed" : "#a78bfa",
                borderBottom: isActive ? "2px solid #7c3aed" : "2px solid transparent",
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

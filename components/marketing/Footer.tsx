import Link from "next/link"
import { BrandMark } from "./BrandMark"

export function Footer() {
  return (
    <footer style={{ backgroundColor: "#fff7ed", borderTop: "1px solid #f0d9c0" }}>
      <div className="max-w-5xl mx-auto w-full px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <BrandMark />
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" style={{ color: "#6d28d9" }}>
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
          <Link href="/signup" className="hover:underline">
            Sign up
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms of Use
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </nav>
        <p className="text-xs" style={{ color: "#a78bfa" }}>
          © 2026 My Genie Stories
        </p>
      </div>
    </footer>
  )
}

import Link from "next/link"

// Brand lockup (✦ gold badge + wordmark), shared by the marketing header and footer.
// Mirrors the badge used in app/(auth)/layout.tsx so the public site matches the app.
export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-lg"
        style={{ backgroundColor: "#fef3c7", border: "1.5px solid #fbbf24" }}
      >
        ✦
      </span>
      <span className="text-lg font-bold" style={{ color: "#6d28d9" }}>
        My Genie Stories
      </span>
    </Link>
  )
}

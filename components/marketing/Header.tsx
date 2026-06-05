import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandMark } from "./BrandMark"

// Sticky public header. Cream nav background matches the dashboard nav.
export function Header() {
  return (
    <header
      className="sticky top-0 z-30 w-full border-b backdrop-blur"
      style={{ backgroundColor: "rgba(255,247,237,0.9)", borderColor: "#f0d9c0" }}
    >
      <div className="max-w-5xl mx-auto w-full px-4 h-16 flex items-center justify-between">
        <BrandMark />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login" style={{ color: "#6d28d9" }}>
              Log in
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Get started free</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}

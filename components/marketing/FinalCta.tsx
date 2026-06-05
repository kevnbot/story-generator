import Link from "next/link"
import { Button } from "@/components/ui/button"

// Closing CTA band — pricing teaser + final push to sign up.
export function FinalCta() {
  return (
    <section className="max-w-5xl mx-auto w-full px-4 py-16 md:py-24">
      <div
        className="rounded-3xl px-6 py-12 md:py-16 text-center"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          Grant your first wish tonight
        </h2>
        <p className="mt-4 text-lg" style={{ color: "#e9d5ff" }}>
          Start free with ✦ wishes on us — no card required. Upgrade anytime as your library grows.
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="bg-white text-[#6d28d9] hover:bg-white/90"
          >
            <Link href="/signup">✦ Start your first story free</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

import Link from "next/link"
import { Button } from "@/components/ui/button"

// "Star your whole family" — kids AND parents as characters in the story.
export function FamilyCharacters() {
  return (
    <section className="max-w-5xl mx-auto w-full px-4 py-16 md:py-24">
      <div
        className="rounded-3xl p-8 md:p-12"
        style={{ background: "linear-gradient(135deg, #f5f0ff 0%, #fef3c7 100%)", border: "1.5px solid #f0d9c0" }}
      >
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#a78bfa" }}>
              The whole family
            </p>
            <h2 className="text-3xl font-bold mt-2" style={{ color: "#3b0764" }}>
              Put everyone in the story
            </h2>
            <p className="mt-4 text-lg leading-relaxed" style={{ color: "#6d28d9" }}>
              It&apos;s not just your child. Add siblings for an adventure together, or write
              yourself in as the grown-up hero by their side. Every character keeps their own
              look, personality, and favorite toy across every page.
            </p>
            <div className="mt-7 flex justify-center md:justify-start">
              <Button asChild size="lg">
                <Link href="/signup">Create your family&apos;s cast</Link>
              </Button>
            </div>
          </div>

          {/* Simple character "trading cards" hint at the profile system */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { emoji: "👧", name: "Mia", tag: "Curious · loves dragons" },
              { emoji: "👦", name: "Leo", tag: "Brave · superhero fan" },
              { emoji: "🧑", name: "Dad", tag: "Goofy · the sidekick" },
              { emoji: "🧸", name: "Mr. Bun", tag: "Mia's brave bunny" },
            ].map((c) => (
              <div
                key={c.name}
                className="rounded-2xl p-4 text-center"
                style={{ backgroundColor: "#ffffff", border: "1.5px solid #f0d9c0" }}
              >
                <div className="text-3xl">{c.emoji}</div>
                <p className="text-sm font-bold mt-2" style={{ color: "#3b0764" }}>
                  {c.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#a78bfa" }}>
                  {c.tag}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

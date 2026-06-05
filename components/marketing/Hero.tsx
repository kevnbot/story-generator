import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

// Hero — answers "what is this?" in one glance, with a CTA to sign up.
export function Hero() {
  return (
    <section className="max-w-5xl mx-auto w-full px-4 pt-12 pb-16 md:pt-20 md:pb-24">
      <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
        {/* Copy */}
        <div className="text-center md:text-left">
          <span
            className="inline-block text-xs font-semibold uppercase tracking-wide rounded-full px-3 py-1 mb-5"
            style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fbbf24" }}
          >
            ✦ Personalized story magic
          </span>
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight"
            style={{ color: "#3b0764" }}
          >
            Bedtime stories where your child is the hero.
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: "#6d28d9" }}>
            My Genie Stories creates personalized, beautifully illustrated stories starring your
            kids — and the whole family. Pick a story type and art style, and the genie writes and
            illustrates it in seconds.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button asChild size="lg">
              <Link href="/signup">✦ Start your first story free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#how-it-works" style={{ color: "#6d28d9" }}>
                See how it works
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm" style={{ color: "#a78bfa" }}>
            Safe, age-appropriate, and ad-free. Free wishes to start — no card required.
          </p>
        </div>

        {/* Visual: mascot + a stylized storybook mock */}
        <div className="relative flex justify-center md:justify-end">
          <div
            className="relative w-full max-w-sm rounded-3xl p-6 shadow-sm"
            style={{ backgroundColor: "#ffffff", border: "1.5px solid #f0d9c0" }}
          >
            <div
              className="rounded-2xl aspect-4/3 flex items-center justify-center overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #f5f0ff 0%, #fef3c7 100%)",
              }}
            >
              <Image
                src="/images/luma-sitting-no-background.png"
                alt="Luma, the My Genie Stories mascot"
                width={260}
                height={260}
                priority
                className="object-contain drop-shadow-md"
              />
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#a78bfa" }}>
                Tonight&apos;s story
              </p>
              <p className="text-lg font-bold" style={{ color: "#3b0764" }}>
                Mia and the Sleepy Moon Dragon
              </p>
              <p className="text-sm mt-1" style={{ color: "#6d28d9" }}>
                Bedtime Story · Soft Watercolor · Read Together
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

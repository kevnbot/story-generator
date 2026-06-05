import type { Metadata } from "next"
import { Header } from "@/components/marketing/Header"
import { Hero } from "@/components/marketing/Hero"
import { HowItWorks } from "@/components/marketing/HowItWorks"
import { FamilyCharacters } from "@/components/marketing/FamilyCharacters"
import { Features } from "@/components/marketing/Features"
import { FinalCta } from "@/components/marketing/FinalCta"
import { Footer } from "@/components/marketing/Footer"

export const metadata: Metadata = {
  title: "My Genie Stories — Personalized bedtime stories starring your kids",
  description:
    "Create personalized, AI-illustrated bedtime stories starring your child and your whole family. Pick a story type and art style, and the genie writes and illustrates it in seconds.",
  openGraph: {
    title: "My Genie Stories — Personalized bedtime stories starring your kids",
    description:
      "Personalized, beautifully illustrated stories where your child is the hero. Free wishes to start.",
    type: "website",
  },
}

// Public marketing landing page. Signed-in visitors are redirected to /generate by proxy.ts,
// so this renders for logged-out visitors only and stays a static Server Component.
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#fffbf5" }}>
      <Header />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <FamilyCharacters />
        <Features />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

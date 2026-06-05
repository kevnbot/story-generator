import { Header } from "./Header"
import { Footer } from "./Footer"

// Shared shell for static legal pages (Terms, Privacy). Renders the marketing
// header/footer with a readable, centered prose container.
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#fffbf5" }}>
      <Header />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto w-full px-4 py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "#3b0764" }}>
            {title}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#a78bfa" }}>
            Last updated: {lastUpdated}
          </p>
          <div className="legal-prose mt-8 space-y-6" style={{ color: "#4c1d95" }}>
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}

// Small presentational helpers so the policy pages stay readable and consistent.
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold" style={{ color: "#3b0764" }}>
        {heading}
      </h2>
      {children}
    </section>
  )
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base leading-relaxed" style={{ color: "#5b21b6" }}>
      {children}
    </p>
  )
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="text-base leading-relaxed" style={{ color: "#5b21b6" }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

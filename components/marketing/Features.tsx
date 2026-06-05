// Feature highlights — appeals to both kids (the magic) and parents (the value).
const FEATURES = [
  {
    emoji: "✨",
    title: "Truly personalized",
    body: "Their hair, eyes, freckles, and favorite toy show up on every illustrated page.",
  },
  {
    emoji: "🎨",
    title: "8 art styles",
    body: "Soft Watercolor, Classic Storybook, 3D Pixar-Style, Anime/Manga, and more.",
  },
  {
    emoji: "📖",
    title: "A story for every moment",
    body: "Bedtime, adventure, mystery, learning, or a birthday and special occasions.",
  },
  {
    emoji: "🔤",
    title: "Read your way",
    body: "Early Reader, Read Together, or Read Aloud — matched to your child's level.",
  },
  {
    emoji: "📚",
    title: "Your forever library",
    body: "Every story is saved as a keepsake you can revisit and re-read anytime.",
  },
  {
    emoji: "🛡️",
    title: "Made for families",
    body: "Age-appropriate, ad-free, and private — built for parents to trust.",
  },
]

export function Features() {
  return (
    <section
      style={{ backgroundColor: "#fff7ed", borderTop: "1px solid #f0d9c0", borderBottom: "1px solid #f0d9c0" }}
    >
      <div className="max-w-5xl mx-auto w-full px-4 py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#a78bfa" }}>
            Why families love it
          </p>
          <h2 className="text-3xl font-bold mt-2" style={{ color: "#3b0764" }}>
            Everything you need for magical story time
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-6"
              style={{ backgroundColor: "#ffffff", border: "1.5px solid #f0d9c0" }}
            >
              <div className="text-2xl">{f.emoji}</div>
              <h3 className="text-lg font-bold mt-3" style={{ color: "#3b0764" }}>
                {f.title}
              </h3>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#6d28d9" }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

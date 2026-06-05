// How it works — three quick steps so parents grok the product fast.
const STEPS = [
  {
    emoji: "🧒",
    title: "Create your characters",
    body: "Add your child — and yourself — with their name, looks, personality, and favorite toy.",
  },
  {
    emoji: "🎨",
    title: "Pick a story & style",
    body: "Choose a story type and one of 8 art styles, from Soft Watercolor to 3D Pixar-Style.",
  },
  {
    emoji: "✦",
    title: "Grant your wish",
    body: "Get a fully illustrated story in seconds, saved to your family library forever.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20"
      style={{ backgroundColor: "#fff7ed", borderTop: "1px solid #f0d9c0", borderBottom: "1px solid #f0d9c0" }}
    >
      <div className="max-w-5xl mx-auto w-full px-4 py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#a78bfa" }}>
            How it works
          </p>
          <h2 className="text-3xl font-bold mt-2" style={{ color: "#3b0764" }}>
            From idea to illustrated story in three steps
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl p-6 text-center md:text-left"
              style={{ backgroundColor: "#ffffff", border: "1.5px solid #f0d9c0" }}
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl mb-4"
                style={{ backgroundColor: "#f5f0ff", border: "1.5px solid #c4b5fd" }}
              >
                {step.emoji}
              </div>
              <p className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
                Step {i + 1}
              </p>
              <h3 className="text-lg font-bold mt-1" style={{ color: "#3b0764" }}>
                {step.title}
              </h3>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#6d28d9" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

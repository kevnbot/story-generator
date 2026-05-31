export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#fffbf5" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ backgroundColor: "#fef3c7", border: "1.5px solid #fbbf24" }}
          >
            <span className="text-2xl">✦</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#6d28d9" }}>My Genie Stories</h1>
          <p className="text-sm mt-1" style={{ color: "#a78bfa" }}>
            Personalized bedtime stories for your family
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}

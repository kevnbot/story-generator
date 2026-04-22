export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <span className="text-2xl">📖</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-800">Story Generator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalized bedtime stories for your family
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}

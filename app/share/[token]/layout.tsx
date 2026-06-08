export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1c0f35" }}>
      <div className="relative flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

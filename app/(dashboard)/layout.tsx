import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { Nav } from "@/components/dashboard/nav"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: profile } = await service
    .from("users")
    .select("display_name, account_id")
    .eq("id", user.id)
    .single()

  const { data: account } = profile?.account_id
    ? await service
        .from("accounts")
        .select("credit_balance")
        .eq("id", profile.account_id)
        .single()
    : { data: null }

  const hasAdminAccess = await isPlatformAdmin(user.id)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#fffbf5" }}>
      <Nav
        userName={profile?.display_name ?? null}
        credits={account?.credit_balance ?? 0}
        isAdmin={hasAdminAccess}
      />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-20 md:pb-6">{children}</main>
    </div>
  )
}

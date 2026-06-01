import { createClient, createServiceClient } from "@/lib/supabase/server"

export type BillingOwnerUserRow = {
  account_id: string
  role: string
  email: string
  display_name: string | null
}

export type BillingOwnerContext =
  | {
      ok: true
      user: { id: string; email?: string | null }
      userRow: BillingOwnerUserRow
      service: ReturnType<typeof createServiceClient>
    }
  | {
      ok: false
      error: "login" | "owner_required"
    }

export async function getBillingOwnerContext(): Promise<BillingOwnerContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "login" }

  const service = createServiceClient()
  const { data: userRow } = await service
    .from("users")
    .select("account_id, role, email, display_name")
    .eq("id", user.id)
    .single()

  const row = userRow as BillingOwnerUserRow | null
  if (!row) return { ok: false, error: "login" }
  if (row.role !== "owner") return { ok: false, error: "owner_required" }

  return { ok: true, user, userRow: row, service }
}

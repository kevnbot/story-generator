import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { AdminBillingTable } from "@/components/admin/billing/AdminBillingTable"
import type { BillingSubscription, CreditTransaction, StripeEventLog } from "@/types"

export const metadata = {
  title: "Billing | Admin",
}

type AccountRow = {
  id: string
  name: string
  credit_balance: number
}

type OwnerRow = {
  account_id: string
  email: string
}

export default async function AdminBillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isPlatformAdmin(user.id))) redirect("/generate")

  const service = createServiceClient()
  const { data: subscriptionRows } = await service
    .from("billing_subscriptions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100)

  const subscriptions = (subscriptionRows ?? []) as BillingSubscription[]
  const accountIds = Array.from(new Set(subscriptions.map((subscription) => subscription.account_id)))

  const [accountsResult, ownersResult, grantsResult, eventsResult] = accountIds.length
    ? await Promise.all([
        service
          .from("accounts")
          .select("id, name, credit_balance")
          .in("id", accountIds),
        service
          .from("users")
          .select("account_id, email")
          .in("account_id", accountIds)
          .eq("role", "owner")
          .is("deleted_at", null),
        service
          .from("credit_transactions")
          .select("*")
          .in("account_id", accountIds)
          .eq("type", "subscription_grant")
          .order("created_at", { ascending: false })
          .limit(200),
        service
          .from("stripe_events")
          .select("*")
          .in("account_id", accountIds)
          .order("created_at", { ascending: false })
          .limit(200),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ]

  const accounts = new Map((accountsResult.data as AccountRow[]).map((account) => [account.id, account]))
  const owners = new Map((ownersResult.data as OwnerRow[]).map((owner) => [owner.account_id, owner.email]))
  const grants = new Map<string, CreditTransaction>()
  for (const grant of (grantsResult.data ?? []) as CreditTransaction[]) {
    if (!grants.has(grant.account_id)) grants.set(grant.account_id, grant)
  }
  const events = new Map<string, StripeEventLog>()
  for (const event of (eventsResult.data ?? []) as StripeEventLog[]) {
    if (event.account_id && !events.has(event.account_id)) events.set(event.account_id, event)
  }

  const rows = subscriptions.map((subscription) => {
    const account = accounts.get(subscription.account_id)
    return {
      accountId: subscription.account_id,
      accountName: account?.name ?? "Unknown account",
      ownerEmail: owners.get(subscription.account_id) ?? null,
      creditBalance: account?.credit_balance ?? 0,
      subscription,
      lastGrant: grants.get(subscription.account_id) ?? null,
      lastEvent: events.get(subscription.account_id) ?? null,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-2xl font-semibold text-foreground">Billing</h1>
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            Prompt Log
          </Link>
          <Link href="/admin/workbench" className="text-sm text-muted-foreground hover:text-foreground">
            Prompt Workbench
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Account subscription state, latest invoice tax, payment health, and wish grants.
        </p>
      </div>

      <AdminBillingTable rows={rows} />
    </div>
  )
}

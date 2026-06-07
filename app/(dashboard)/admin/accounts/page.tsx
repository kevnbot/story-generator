import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { AdminAccountsTable } from "@/components/admin/accounts/AdminAccountsTable"

export const metadata = {
  title: "Accounts | Admin",
}

type AccountRow = {
  id: string
  name: string
  credit_balance: number
  plan: string
  created_at: string
}

type OwnerRow = {
  account_id: string
  display_name: string | null
  email: string
}

type SubscriptionRow = {
  account_id: string
  plan: string
  status: string
}

function tallyByAccount(rows: { account_id: string }[] | null): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows ?? []) {
    counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1)
  }
  return counts
}

export default async function AdminAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isPlatformAdmin(user.id))) redirect("/generate")

  const service = createServiceClient()

  const { data: accountRows } = await service
    .from("accounts")
    .select("id, name, credit_balance, plan, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  const accounts = (accountRows ?? []) as AccountRow[]
  const accountIds = accounts.map((account) => account.id)

  const [ownersResult, charactersResult, storiesResult, subscriptionsResult] = accountIds.length
    ? await Promise.all([
        service
          .from("users")
          .select("account_id, display_name, email")
          .in("account_id", accountIds)
          .eq("role", "owner")
          .is("deleted_at", null),
        service
          .from("kid_profiles")
          .select("account_id")
          .in("account_id", accountIds)
          .is("deleted_at", null),
        service
          .from("stories")
          .select("account_id")
          .in("account_id", accountIds)
          .is("deleted_at", null),
        service
          .from("billing_subscriptions")
          .select("account_id, plan, status")
          .in("account_id", accountIds)
          .order("updated_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const owners = new Map<string, OwnerRow>()
  for (const owner of (ownersResult.data ?? []) as OwnerRow[]) {
    if (!owners.has(owner.account_id)) owners.set(owner.account_id, owner)
  }

  const characterCounts = tallyByAccount(charactersResult.data as { account_id: string }[] | null)
  const storyCounts = tallyByAccount(storiesResult.data as { account_id: string }[] | null)

  // First row per account is the most recently updated subscription.
  const subscriptions = new Map<string, SubscriptionRow>()
  for (const sub of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
    if (!subscriptions.has(sub.account_id)) subscriptions.set(sub.account_id, sub)
  }

  const rows = accounts.map((account) => {
    const owner = owners.get(account.id)
    const subscription = subscriptions.get(account.id) ?? null
    return {
      accountId: account.id,
      accountName: account.name,
      plan: account.plan,
      ownerName: owner?.display_name || owner?.email || "—",
      ownerEmail: owner?.email ?? null,
      wishes: account.credit_balance,
      subscriptionPlan: subscription?.plan ?? null,
      subscriptionStatus: subscription?.status ?? null,
      characterCount: characterCounts.get(account.id) ?? 0,
      storyCount: storyCounts.get(account.id) ?? 0,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} accounts. Search by account or owner name, and click a column to sort.
        </p>
      </div>

      <AdminAccountsTable rows={rows} />
    </div>
  )
}

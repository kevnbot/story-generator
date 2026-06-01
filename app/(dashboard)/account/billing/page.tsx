import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { BillingPage } from "@/components/billing/BillingPage"
import type { AccountBillingProfile, BillingSubscription, CreditTransaction } from "@/types"

export const metadata = {
  title: "Billing | My Genie Stories",
}

export default async function AccountBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: userRow } = await service
    .from("users")
    .select("account_id, role")
    .eq("id", user.id)
    .single()

  if (!userRow) redirect("/login")

  const [accountResult, profileResult, subscriptionResult, grantResult] = await Promise.all([
    service
      .from("accounts")
      .select("credit_balance, plan")
      .eq("id", userRow.account_id)
      .single(),
    service
      .from("account_billing_profiles")
      .select("*")
      .eq("account_id", userRow.account_id)
      .maybeSingle(),
    service
      .from("billing_subscriptions")
      .select("*")
      .eq("account_id", userRow.account_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("credit_transactions")
      .select("*")
      .eq("account_id", userRow.account_id)
      .eq("type", "subscription_grant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const { checkout, error } = await searchParams

  return (
    <BillingPage
      account={accountResult.data ?? { credit_balance: 0, plan: "free" }}
      profile={(profileResult.data as AccountBillingProfile | null) ?? null}
      subscription={(subscriptionResult.data as BillingSubscription | null) ?? null}
      lastGrant={(grantResult.data as CreditTransaction | null) ?? null}
      userRole={userRow.role}
      message={checkout === "success" || checkout === "canceled" ? checkout : null}
      error={error ?? null}
    />
  )
}

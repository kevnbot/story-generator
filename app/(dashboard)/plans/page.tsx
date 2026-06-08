import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { PlansView } from "@/components/billing/PlansView"
import {
  BILLING_PLANS,
  getBillingPriceId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plans"

// Whether each plan/interval has a Stripe price configured. Resolved on the
// server because it reads STRIPE_PRICE_* env vars that are not available in the
// client bundle — passing it down avoids a hydration mismatch in PlansView.
function resolveConfiguredPricing() {
  return (Object.keys(BILLING_PLANS) as BillingPlanId[]).reduce((acc, planId) => {
    acc[planId] = {
      month: Boolean(getBillingPriceId(planId, "month")),
      year: Boolean(getBillingPriceId(planId, "year")),
    }
    return acc
  }, {} as Record<BillingPlanId, Record<BillingInterval, boolean>>)
}

export const metadata = {
  title: "Plans | My Genie Stories",
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>
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

  const [accountResult, subscriptionResult] = await Promise.all([
    service
      .from("accounts")
      .select("credit_balance")
      .eq("id", userRow.account_id)
      .single(),
    service
      .from("billing_subscriptions")
      .select("status")
      .eq("account_id", userRow.account_id)
      .in("status", ["trialing", "active", "past_due", "unpaid", "paused"])
      .limit(1)
      .maybeSingle(),
  ])

  const { error, checkout } = await searchParams

  return (
    <PlansView
      userRole={userRow.role}
      credits={accountResult.data?.credit_balance ?? 0}
      hasActiveSubscription={Boolean(subscriptionResult.data)}
      pricing={resolveConfiguredPricing()}
      error={error ?? null}
      message={checkout === "success" || checkout === "canceled" ? checkout : null}
    />
  )
}

"use server"

import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import {
  getBillingPlanOption,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plans"
import { getAppUrl, getStripe, isStripeAutomaticTaxEnabled } from "@/lib/billing/stripe"

type BillingUserRow = {
  account_id: string
  role: string
  email: string
  display_name: string | null
}

async function requireOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: userRow } = await service
    .from("users")
    .select("account_id, role, email, display_name")
    .eq("id", user.id)
    .single()

  const row = userRow as BillingUserRow | null
  if (!row) redirect("/login")
  if (row.role !== "owner") redirect("/account/billing?error=owner_required")

  return { user, userRow: row, service }
}

export async function startBillingCheckout(planId: BillingPlanId, interval: BillingInterval) {
  if (!isBillingPlanId(planId) || !isBillingInterval(interval)) {
    redirect("/account/billing?error=invalid_plan")
  }

  const option = getBillingPlanOption(planId, interval)
  if (!option.priceId) {
    redirect("/account/billing?error=billing_unavailable")
  }

  const { user, userRow, service } = await requireOwner()
  const { data: existingSubscription } = await service
    .from("billing_subscriptions")
    .select("stripe_subscription_id")
    .eq("account_id", userRow.account_id)
    .in("status", ["trialing", "active", "past_due", "unpaid", "paused"])
    .limit(1)
    .maybeSingle()

  if (existingSubscription) {
    redirect("/account/billing?error=use_portal")
  }

  const automaticTaxEnabled = isStripeAutomaticTaxEnabled()
  const stripe = getStripe()
  const appUrl = getAppUrl()
  const successUrl = `${appUrl}/account/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${appUrl}/account/billing?checkout=canceled`

  const { data: billingProfile } = await service
    .from("account_billing_profiles")
    .select("stripe_customer_id")
    .eq("account_id", userRow.account_id)
    .maybeSingle()

  const metadata = {
    account_id: userRow.account_id,
    user_id: user.id,
    plan: option.plan.id,
    billing_interval: option.interval,
    monthly_wishes: String(option.plan.monthlyWishes),
    wishes_granted: String(option.wishesGranted),
  }

  const customerId = (billingProfile?.stripe_customer_id as string | undefined) ?? null
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: option.priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userRow.account_id,
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : userRow.email,
    customer_update: customerId ? { address: "auto", name: "auto" } : undefined,
    billing_address_collection: automaticTaxEnabled ? "required" : "auto",
    automatic_tax: { enabled: automaticTaxEnabled },
    allow_promotion_codes: true,
    metadata,
    subscription_data: { metadata },
  })

  if (!session.url) redirect("/account/billing?error=checkout_failed")

  await service.from("billing_checkout_sessions").insert({
    account_id: userRow.account_id,
    user_id: user.id,
    stripe_session_id: session.id,
    stripe_customer_id: customerId,
    plan: option.plan.id,
    billing_interval: option.interval,
    stripe_price_id: option.priceId,
    monthly_wishes: option.plan.monthlyWishes,
    wishes_granted: option.wishesGranted,
    status: session.status ?? "open",
    automatic_tax_enabled: automaticTaxEnabled,
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  redirect(session.url)
}

export async function openBillingPortal() {
  const { userRow, service } = await requireOwner()
  const { data: billingProfile } = await service
    .from("account_billing_profiles")
    .select("stripe_customer_id")
    .eq("account_id", userRow.account_id)
    .maybeSingle()

  const customerId = billingProfile?.stripe_customer_id as string | undefined
  if (!customerId) redirect("/account/billing?error=no_customer")

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/account/billing`,
  })

  redirect(session.url)
}

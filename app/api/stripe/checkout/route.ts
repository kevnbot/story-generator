import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import {
  getBillingPlanOption,
  isBillingInterval,
  isBillingPlanId,
} from "@/lib/billing/plans"
import { getStripe, isStripeAutomaticTaxEnabled } from "@/lib/billing/stripe"
import { getBillingOwnerContext } from "@/lib/billing/owner"

function billingRedirect(request: Request, params?: Record<string, string>) {
  const url = new URL("/account/billing", request.url)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url, { status: 303 })
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const planId = String(formData.get("plan") ?? "")
  const interval = String(formData.get("interval") ?? "")

  if (!isBillingPlanId(planId) || !isBillingInterval(interval)) {
    return billingRedirect(request, { error: "invalid_plan" })
  }

  const option = getBillingPlanOption(planId, interval)
  if (!option.priceId) {
    return billingRedirect(request, { error: "billing_unavailable" })
  }

  const context = await getBillingOwnerContext()
  if (!context.ok) {
    if (context.error === "login") return NextResponse.redirect(new URL("/login", request.url), { status: 303 })
    return billingRedirect(request, { error: "owner_required" })
  }

  const { user, userRow, service } = context
  const { data: existingSubscription } = await service
    .from("billing_subscriptions")
    .select("stripe_subscription_id")
    .eq("account_id", userRow.account_id)
    .in("status", ["trialing", "active", "past_due", "unpaid", "paused"])
    .limit(1)
    .maybeSingle()

  if (existingSubscription) {
    return billingRedirect(request, { error: "use_portal" })
  }

  const automaticTaxEnabled = isStripeAutomaticTaxEnabled()
  const origin = new URL(request.url).origin
  const successUrl = `${origin}/account/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${origin}/account/billing?checkout=canceled`

  try {
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
    const session = await getStripe().checkout.sessions.create({
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

    if (!session.url) {
      return billingRedirect(request, { error: "checkout_failed" })
    }

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

    return NextResponse.redirect(session.url, { status: 303 })
  } catch (error) {
    Sentry.logger.error("Stripe checkout session creation failed", {
      user_id: user.id,
      account_id: userRow.account_id,
      billing_plan: option.plan.id,
      billing_interval: option.interval,
    })
    Sentry.captureException(error, {
      tags: { area: "billing", operation: "checkout" },
      extra: {
        user_id: user.id,
        account_id: userRow.account_id,
        billing_plan: option.plan.id,
        billing_interval: option.interval,
      },
    })
    return billingRedirect(request, { error: "checkout_failed" })
  }
}

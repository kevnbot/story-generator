import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { logError } from "@/lib/logger"
import { getBillingOwnerContext } from "@/lib/billing/owner"
import { getStripe } from "@/lib/billing/stripe"
import { getBillingPriceId, isBillingInterval, isBillingPlanId } from "@/lib/billing/plans"
import { getPlanChangePortalConfigurationId } from "@/lib/billing/portal-config"

// Only allow returning to known internal billing surfaces to avoid open redirects.
const RETURN_PATHS = new Set(["/account/billing", "/plans"])

function resolveReturnPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : ""
  return RETURN_PATHS.has(path) ? path : "/account/billing"
}

function billingRedirect(request: Request, returnPath: string, params?: Record<string, string>) {
  const url = new URL(returnPath, request.url)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url, { status: 303 })
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const returnPath = resolveReturnPath(formData.get("return_to"))
  const planValue = String(formData.get("plan") ?? "")
  const intervalValue = String(formData.get("interval") ?? "")

  const context = await getBillingOwnerContext()
  if (!context.ok) {
    if (context.error === "login") return NextResponse.redirect(new URL("/login", request.url), { status: 303 })
    return billingRedirect(request, returnPath, { error: "owner_required" })
  }

  const { user, userRow, service } = context
  const { data: billingProfile } = await service
    .from("account_billing_profiles")
    .select("stripe_customer_id")
    .eq("account_id", userRow.account_id)
    .maybeSingle()

  const customerId = billingProfile?.stripe_customer_id as string | undefined
  if (!customerId) return billingRedirect(request, returnPath, { error: "no_customer" })

  const returnUrl = `${new URL(request.url).origin}${returnPath}`

  try {
    const stripe = getStripe()
    let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined
    let configurationId: string | null = null

    // When a target plan is provided (the "Choose plan" buttons on /plans),
    // deep-link straight into Stripe's plan-change flow instead of dropping the
    // user on the generic portal home.
    if (isBillingPlanId(planValue) && isBillingInterval(intervalValue)) {
      const { data: sub } = await service
        .from("billing_subscriptions")
        .select("stripe_subscription_id, stripe_price_id")
        .eq("account_id", userRow.account_id)
        .in("status", ["trialing", "active", "past_due", "unpaid", "paused"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const subscriptionId = sub?.stripe_subscription_id as string | undefined
      const targetPrice = getBillingPriceId(planValue, intervalValue)

      // Use an app-managed portal configuration with plan switching enabled,
      // rather than the account's ambiguous default configuration.
      if (subscriptionId) {
        configurationId = await getPlanChangePortalConfigurationId(stripe)
      }

      if (subscriptionId && configurationId) {
        // Pre-confirm the switch to the selected price when it differs from the
        // current one. Stripe needs the subscription item id, which we don't
        // persist, so fetch it from the live subscription.
        if (targetPrice && targetPrice !== sub?.stripe_price_id) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const itemId = subscription.items.data[0]?.id
          if (itemId) {
            flowData = {
              type: "subscription_update_confirm",
              subscription_update_confirm: {
                subscription: subscriptionId,
                items: [{ id: itemId, price: targetPrice }],
              },
            }
          }
        }

        // Fall back to the plan-selection page (user picks) when we can't
        // pre-confirm — e.g. they're already on the selected price.
        flowData ??= {
          type: "subscription_update",
          subscription_update: { subscription: subscriptionId },
        }
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      ...(configurationId ? { configuration: configurationId } : {}),
      ...(flowData ? { flow_data: flowData } : {}),
    })

    return NextResponse.redirect(session.url, { status: 303 })
  } catch (error) {
    logError("Stripe billing portal session creation failed", error, {
      area: "billing",
      operation: "portal",
      user_id: user.id,
      account_id: userRow.account_id,
    })
    return billingRedirect(request, returnPath, { error: "portal_failed" })
  }
}

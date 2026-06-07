import { NextResponse } from "next/server"
import { logError } from "@/lib/logger"
import { getBillingOwnerContext } from "@/lib/billing/owner"
import { getStripe } from "@/lib/billing/stripe"

function billingRedirect(request: Request, params?: Record<string, string>) {
  const url = new URL("/account/billing", request.url)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url, { status: 303 })
}

export async function POST(request: Request) {
  const context = await getBillingOwnerContext()
  if (!context.ok) {
    if (context.error === "login") return NextResponse.redirect(new URL("/login", request.url), { status: 303 })
    return billingRedirect(request, { error: "owner_required" })
  }

  const { user, userRow, service } = context
  const { data: billingProfile } = await service
    .from("account_billing_profiles")
    .select("stripe_customer_id")
    .eq("account_id", userRow.account_id)
    .maybeSingle()

  const customerId = billingProfile?.stripe_customer_id as string | undefined
  if (!customerId) return billingRedirect(request, { error: "no_customer" })

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${new URL(request.url).origin}/account/billing`,
    })

    return NextResponse.redirect(session.url, { status: 303 })
  } catch (error) {
    logError("Stripe billing portal session creation failed", error, {
      area: "billing",
      operation: "portal",
      user_id: user.id,
      account_id: userRow.account_id,
    })
    return billingRedirect(request, { error: "portal_failed" })
  }
}

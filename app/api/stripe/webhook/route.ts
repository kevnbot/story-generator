import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/billing/stripe"
import { handleStripeEvent } from "@/lib/billing/stripe-webhooks"

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook secret is not configured" }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  const stripe = getStripe()
  const body = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 })
  }

  try {
    await handleStripeEvent(event, stripe)
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

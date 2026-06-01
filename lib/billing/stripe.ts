import Stripe from "stripe"

export const STRIPE_API_VERSION = "2026-05-27.dahlia"
export const STRIPE_AI_TAX_CODE = "txcd_10105001"

let stripeClient: Stripe | null = null

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  })

  return stripeClient
}

export function isStripeAutomaticTaxEnabled() {
  return process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true"
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

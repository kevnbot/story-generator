import type Stripe from "stripe"
import { getBillingPriceId, type BillingInterval, type BillingPlanId } from "./plans"

// Tag used to find the billing-portal configuration this app manages, so we
// reuse one instead of creating duplicates.
const MANAGED_BY = "story-generator:plan-change"

const PLAN_INTERVALS: Array<[BillingPlanId, BillingInterval]> = [
  ["starter", "month"],
  ["starter", "year"],
  ["family", "month"],
  ["family", "year"],
]

// Cached for the lifetime of the process to avoid re-listing on every request.
let cachedConfigurationId: string | null = null

// Build the `subscription_update.products` allowlist from the configured Stripe
// prices, grouped by their parent product (required for plan switching).
async function buildSubscriptionProducts(stripe: Stripe) {
  const pricesByProduct = new Map<string, Set<string>>()

  for (const [plan, interval] of PLAN_INTERVALS) {
    const priceId = getBillingPriceId(plan, interval)
    if (!priceId) continue
    try {
      const price = await stripe.prices.retrieve(priceId)
      const productId = typeof price.product === "string" ? price.product : price.product.id
      if (!pricesByProduct.has(productId)) pricesByProduct.set(productId, new Set())
      pricesByProduct.get(productId)!.add(priceId)
    } catch {
      // Skip prices that can't be resolved (e.g. wrong id / different account).
    }
  }

  return Array.from(pricesByProduct.entries()).map(([product, prices]) => ({
    product,
    prices: Array.from(prices),
  }))
}

// Returns the id of an app-managed billing-portal configuration that has
// subscription update (plan switching) enabled for our products. Reuses an
// existing one when present, otherwise creates it. Returns null if no prices
// are configured. Passing this configuration explicitly to portal sessions
// avoids depending on the account's ambiguous "default" configuration.
export async function getPlanChangePortalConfigurationId(stripe: Stripe): Promise<string | null> {
  if (cachedConfigurationId) return cachedConfigurationId

  const products = await buildSubscriptionProducts(stripe)
  if (products.length === 0) return null

  const existing = await stripe.billingPortal.configurations.list({ limit: 100 })
  const found = existing.data.find(
    (config) =>
      config.active &&
      config.metadata?.managed_by === MANAGED_BY &&
      config.features?.subscription_update?.enabled,
  )
  if (found) {
    cachedConfigurationId = found.id
    return found.id
  }

  const created = await stripe.billingPortal.configurations.create({
    metadata: { managed_by: MANAGED_BY },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products,
      },
      subscription_cancel: { enabled: true },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  })

  cachedConfigurationId = created.id
  return created.id
}

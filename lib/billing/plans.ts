export type BillingPlanId = "starter" | "family"
export type BillingInterval = "month" | "year"

export type BillingPlan = {
  id: BillingPlanId
  name: string
  description: string
  monthlyWishes: number
  monthlyAmount: number
  yearlyAmount: number
  highlights: string[]
}

export type BillingPlanOption = {
  plan: BillingPlan
  interval: BillingInterval
  priceId: string | null
  amount: number
  wishesGranted: number
  configured: boolean
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "For casual bedtime story nights.",
    monthlyWishes: 30,
    monthlyAmount: 900,
    yearlyAmount: 9000,
    highlights: [
      "30 wishes every month",
      "About 10 medium illustrated stories",
      "Good for one child",
    ],
  },
  family: {
    id: "family",
    name: "Family",
    description: "For multiple kids and frequent story time.",
    monthlyWishes: 90,
    monthlyAmount: 1900,
    yearlyAmount: 19000,
    highlights: [
      "90 wishes every month",
      "About 30 medium illustrated stories",
      "Best for siblings",
    ],
  },
}

const PRICE_ENV_KEYS: Record<BillingPlanId, Record<BillingInterval, string>> = {
  starter: {
    month: "STRIPE_PRICE_STARTER_MONTHLY",
    year: "STRIPE_PRICE_STARTER_YEARLY",
  },
  family: {
    month: "STRIPE_PRICE_FAMILY_MONTHLY",
    year: "STRIPE_PRICE_FAMILY_YEARLY",
  },
}

export function isBillingPlanId(value: string): value is BillingPlanId {
  return value === "starter" || value === "family"
}

export function isBillingInterval(value: string): value is BillingInterval {
  return value === "month" || value === "year"
}

export function getBillingPlan(planId: BillingPlanId) {
  return BILLING_PLANS[planId]
}

export function getWishesPerInvoice(planId: BillingPlanId, interval: BillingInterval) {
  const monthlyWishes = getBillingPlan(planId).monthlyWishes
  return interval === "year" ? monthlyWishes * 12 : monthlyWishes
}

export function getBillingPriceId(planId: BillingPlanId, interval: BillingInterval) {
  const key = PRICE_ENV_KEYS[planId][interval]
  return process.env[key]?.trim() || null
}

export function getBillingPlanOption(planId: BillingPlanId, interval: BillingInterval): BillingPlanOption {
  const plan = getBillingPlan(planId)
  const priceId = getBillingPriceId(planId, interval)
  return {
    plan,
    interval,
    priceId,
    amount: interval === "year" ? plan.yearlyAmount : plan.monthlyAmount,
    wishesGranted: getWishesPerInvoice(planId, interval),
    configured: Boolean(priceId),
  }
}

export function getBillingPlanOptions() {
  return (Object.keys(BILLING_PLANS) as BillingPlanId[]).flatMap((planId) => [
    getBillingPlanOption(planId, "month"),
    getBillingPlanOption(planId, "year"),
  ])
}

export function findBillingOptionByPriceId(priceId: string | null | undefined) {
  if (!priceId) return null
  return getBillingPlanOptions().find((option) => option.priceId === priceId) ?? null
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function getIntervalLabel(interval: BillingInterval) {
  return interval === "year" ? "year" : "month"
}

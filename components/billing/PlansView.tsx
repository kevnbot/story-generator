"use client"

import { useState } from "react"
import Link from "next/link"
import {
  BILLING_PLANS,
  formatMoney,
  getBillingPlanOption,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plans"

function errorMessage(error: string | null) {
  switch (error) {
    case "owner_required":
      return "Only account owners can manage billing."
    case "billing_unavailable":
      return "Billing is not configured yet."
    case "checkout_failed":
      return "Checkout could not be started."
    case "no_customer":
      return "No Stripe customer exists for this account yet."
    case "use_portal":
      return "Use the billing page to change an existing subscription."
    case "portal_failed":
      return "The Stripe billing portal could not be opened."
    case "invalid_plan":
      return "That billing plan is not available."
    default:
      return null
  }
}

// Monthly/Yearly toggle button. Inline styles override CSS `:hover`, so hover
// state is tracked in React.
function IntervalButton({
  value,
  active,
  onSelect,
}: {
  value: BillingInterval
  active: boolean
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const background = active ? "#fff" : hovered ? "#fffdf7" : "transparent"
  const color = active || hovered ? "#92400e" : "#b45309"

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition"
      style={{
        backgroundColor: background,
        color,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : hovered ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {value === "month" ? "Monthly" : "Yearly"}
      {value === "year" && (
        <span className="ml-1 text-xs font-medium" style={{ color: "#d97706" }}>
          save
        </span>
      )}
    </button>
  )
}

// Primary "Choose plan" CTA for accounts that already have a subscription.
// A second checkout session is not allowed, so this posts straight to the
// Stripe billing portal where an existing plan is changed or managed.
function ChoosePlanButton({ popular, disabled }: { popular: boolean; disabled: boolean }) {
  const [hovered, setHovered] = useState(false)
  const base = popular ? "#7c3aed" : "#d97706"
  const hover = popular ? "#6d28d9" : "#b45309"

  return (
    <form action="/api/stripe/portal" method="post">
      <button
        type="submit"
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: hovered && !disabled ? hover : base }}
      >
        Choose plan
      </button>
    </form>
  )
}

// Footer link to the billing page for managing an existing subscription.
function ManageSubscriptionLink() {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href="/account/billing"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer text-sm font-medium transition-colors"
      style={{ color: hovered ? "#6d28d9" : "#7c3aed", textDecoration: hovered ? "underline" : "none" }}
    >
      Manage existing subscription →
    </Link>
  )
}

function PlanCard({
  planId,
  interval,
  owner,
  hasActiveSubscription,
  popular,
  configured,
}: {
  planId: BillingPlanId
  interval: BillingInterval
  owner: boolean
  hasActiveSubscription: boolean
  popular: boolean
  configured: boolean
}) {
  const plan = BILLING_PLANS[planId]
  const option = getBillingPlanOption(planId, interval)
  const disabled = !owner || !configured

  return (
    <article
      className="relative flex flex-col rounded-2xl bg-white p-6"
      style={{
        border: popular ? "2px solid #c4b5fd" : "1px solid #f0d9c0",
        boxShadow: popular ? "0 10px 30px -12px rgba(124,58,237,0.25)" : "none",
      }}
    >
      {popular && (
        <span
          className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: "#7c3aed", color: "#fff" }}
        >
          Most popular
        </span>
      )}

      <h2 className="text-xl font-semibold" style={{ color: "#6d28d9" }}>
        {plan.name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

      <div className="mt-5 flex items-end gap-1">
        <span className="text-4xl font-bold" style={{ color: "#92400e" }}>
          {formatMoney(option.amount)}
        </span>
        <span className="mb-1 text-sm text-muted-foreground">
          /{interval === "year" ? "year" : "month"}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium" style={{ color: "#d97706" }}>
        ✦ {option.wishesGranted} wishes{interval === "year" ? " upfront" : " every month"}
      </p>

      <ul className="mt-5 mb-6 space-y-2 text-sm text-muted-foreground">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-2">
            <span aria-hidden style={{ color: "#fbbf24" }}>✓</span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        {hasActiveSubscription ? (
          <ChoosePlanButton popular={popular} disabled={!owner} />
        ) : (
          <form action="/api/stripe/checkout" method="post">
            <input type="hidden" name="plan" value={planId} />
            <input type="hidden" name="interval" value={interval} />
            <input type="hidden" name="return_to" value="/plans" />
            <button
              type="submit"
              disabled={disabled}
              className="h-11 w-full cursor-pointer rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: popular ? "#7c3aed" : "#d97706" }}
            >
              {configured ? `Choose ${plan.name}` : "Price not configured"}
            </button>
          </form>
        )}
      </div>
    </article>
  )
}

export function PlansView({
  userRole,
  credits,
  hasActiveSubscription,
  pricing,
  error,
  message,
}: {
  userRole: string
  credits: number
  hasActiveSubscription: boolean
  pricing: Record<BillingPlanId, Record<BillingInterval, boolean>>
  error: string | null
  message: "success" | "canceled" | null
}) {
  const owner = userRole === "owner"
  const [interval, setInterval] = useState<BillingInterval>("month")
  const visibleError = errorMessage(error)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <style>{`
        @keyframes plans-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1; transform: scale(1.2); }
        }
        .plans-spark { display: inline-block; animation: plans-twinkle 2.4s ease-in-out infinite; }
        .plans-spark-1 { animation-delay: 0.8s; }
        .plans-spark-2 { animation-delay: 1.6s; }
        @media (prefers-reduced-motion: reduce) {
          .plans-spark { animation: none; opacity: 0.7; }
        }
      `}</style>

      {/* Hero */}
      <div className="text-center">
        <p className="text-3xl" aria-hidden>
          <span className="plans-spark" style={{ color: "#fbbf24" }}>✦</span>{" "}
          <span className="plans-spark plans-spark-1" style={{ color: "#d97706" }}>✨</span>{" "}
          <span className="plans-spark plans-spark-2" style={{ color: "#fbbf24" }}>✦</span>
        </p>
        <h1 className="mt-3 font-serif text-3xl font-semibold" style={{ color: "#6d28d9" }}>
          Grant more wishes
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Choose a plan to keep the stories flowing. You currently have{" "}
          <span className="font-semibold" style={{ color: "#92400e" }}>{credits} wishes</span>.
        </p>
      </div>

      {message === "success" && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-genie-green-200 bg-genie-green-50 px-4 py-3 text-center text-sm text-genie-green-900">
          Checkout completed. Your wishes will appear after Stripe confirms the paid invoice.
        </div>
      )}
      {message === "canceled" && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-nav-border bg-white px-4 py-3 text-center text-sm text-muted-foreground">
          Checkout was canceled. Your plan was not changed.
        </div>
      )}
      {visibleError && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
          {visibleError}
        </div>
      )}

      {!owner && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-nav-border bg-white px-4 py-3 text-center text-sm text-muted-foreground">
          Ask the account owner to change billing.
        </div>
      )}

      {/* Interval toggle */}
      <div className="mt-8 flex items-center justify-center">
        <div
          className="inline-flex items-center gap-1 rounded-full p-1"
          style={{ backgroundColor: "#fef3c7", border: "1px solid #fbbf24" }}
        >
          {(["month", "year"] as BillingInterval[]).map((value) => (
            <IntervalButton
              key={value}
              value={value}
              active={interval === value}
              onSelect={() => setInterval(value)}
            />
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <section className="mt-8 grid gap-5 md:grid-cols-2">
        {(Object.keys(BILLING_PLANS) as BillingPlanId[]).map((planId) => (
          <PlanCard
            key={planId}
            planId={planId}
            interval={interval}
            owner={owner}
            hasActiveSubscription={hasActiveSubscription}
            popular={planId === "family"}
            configured={pricing[planId][interval]}
          />
        ))}
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">Plus applicable tax.</p>

      <div className="mt-4 text-center">
        <ManageSubscriptionLink />
      </div>
    </div>
  )
}

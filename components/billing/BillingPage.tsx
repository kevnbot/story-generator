import Link from "next/link"
import { BILLING_PLANS } from "@/lib/billing/plans"
import type { AccountBillingProfile, BillingSubscription, CreditTransaction } from "@/types"

type BillingPageProps = {
  account: {
    credit_balance: number
    plan: string
  }
  profile: AccountBillingProfile | null
  subscription: BillingSubscription | null
  lastGrant: CreditTransaction | null
  userRole: string
  message: "success" | "canceled" | null
  error: string | null
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
}

function statusLabel(status: string | null | undefined) {
  if (!status) return "No paid plan"
  return status.replace(/_/g, " ")
}

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
      return "Use Manage billing to change an existing subscription."
    case "portal_failed":
      return "The Stripe billing portal could not be opened."
    case "invalid_plan":
      return "That billing plan is not available."
    default:
      return null
  }
}

export function BillingPage({
  account,
  profile,
  subscription,
  lastGrant,
  userRole,
  message,
  error,
}: BillingPageProps) {
  const owner = userRole === "owner"
  const currentPlan = subscription?.plan ? BILLING_PLANS[subscription.plan] : null
  const visibleError = errorMessage(error)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your subscription and monthly wishes.
          </p>
        </div>
        {profile && owner && (
          <form action="/api/stripe/portal" method="post">
            <button
              type="submit"
              className="h-10 rounded-lg border border-genie-purple-200 px-4 text-sm font-semibold text-genie-purple-700 transition hover:bg-genie-purple-50"
            >
              Manage billing
            </button>
          </form>
        )}
      </div>

      {message === "success" && (
        <div className="mb-4 rounded-lg border border-genie-green-200 bg-genie-green-50 px-4 py-3 text-sm text-genie-green-900">
          Checkout completed. Your wishes will appear after Stripe confirms the paid invoice.
        </div>
      )}
      {message === "canceled" && (
        <div className="mb-4 rounded-lg border border-nav-border bg-nav-bg px-4 py-3 text-sm text-muted-foreground">
          Checkout was canceled. Your plan was not changed.
        </div>
      )}
      {visibleError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {visibleError}
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="flex flex-col rounded-lg border border-nav-border bg-white p-4">
          <p className="text-sm text-muted-foreground">Current wishes</p>
          <p className="mt-2 text-3xl font-semibold text-genie-gold-800">{account.credit_balance}</p>
          <Link
            href="/plans"
            className="mt-3 inline-flex h-9 w-fit items-center justify-center rounded-lg bg-genie-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-genie-purple-700"
          >
            Upgrade plan
          </Link>
        </div>
        <div className="rounded-lg border border-nav-border bg-white p-4">
          <p className="text-sm text-muted-foreground">Plan</p>
          <p className="mt-2 text-xl font-semibold capitalize text-foreground">
            {currentPlan?.name ?? account.plan}
          </p>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {statusLabel(subscription?.status)}
          </p>
        </div>
        <div className="rounded-lg border border-nav-border bg-white p-4">
          <p className="text-sm text-muted-foreground">Next renewal</p>
          <p className="mt-2 text-xl font-semibold text-foreground">
            {formatDate(subscription?.current_period_end ?? null)}
          </p>
          {subscription?.cancel_at_period_end && (
            <p className="mt-1 text-sm text-red-700">Cancels at period end</p>
          )}
        </div>
      </section>

      {subscription && (
        <section className="mb-8 rounded-lg border border-nav-border bg-white p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Allowance</p>
              <p className="mt-1 font-semibold">{subscription.monthly_wishes} wishes/month</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing</p>
              <p className="mt-1 font-semibold capitalize">{subscription.billing_interval}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tax</p>
              <p className="mt-1 font-semibold">
                {subscription.automatic_tax_enabled ? "Automatic" : "Not enabled"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last grant</p>
              <p className="mt-1 font-semibold">
                {lastGrant ? `+${lastGrant.amount} wishes` : "None yet"}
              </p>
            </div>
          </div>
        </section>
      )}

      {!owner && (
        <div className="mb-6 rounded-lg border border-nav-border bg-white px-4 py-3 text-sm text-muted-foreground">
          Ask the account owner to change billing.
        </div>
      )}

    </div>
  )
}

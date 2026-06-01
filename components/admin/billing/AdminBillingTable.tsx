import type { BillingSubscription, CreditTransaction, StripeEventLog } from "@/types"

type AdminBillingRow = {
  accountId: string
  accountName: string
  ownerEmail: string | null
  creditBalance: number
  subscription: BillingSubscription
  lastGrant: CreditTransaction | null
  lastEvent: StripeEventLog | null
}

function formatDate(value: string | null) {
  if (!value) return "n/a"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
}

function formatCents(value: number | null, currency: string | null) {
  if (value == null) return "n/a"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
  }).format(value / 100)
}

export function AdminBillingTable({ rows }: { rows: AdminBillingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-nav-border bg-white p-6 text-sm text-muted-foreground">
        No billing subscriptions have been recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-nav-border bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-nav-border bg-nav-bg text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Stripe</th>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Grant</th>
            <th className="px-4 py-3">Last Event</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nav-border">
          {rows.map(({ accountId, accountName, ownerEmail, creditBalance, subscription, lastGrant, lastEvent }) => (
            <tr key={subscription.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">{accountName}</p>
                <p className="text-xs text-muted-foreground">{ownerEmail ?? "No owner email"}</p>
                <p className="mt-1 text-xs text-genie-gold-800">{creditBalance} wishes</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{accountId}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium capitalize">{subscription.plan}</p>
                <p className="text-xs capitalize text-muted-foreground">{subscription.status}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {subscription.monthly_wishes}/mo · {subscription.billing_interval}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Renews {formatDate(subscription.current_period_end)}
                </p>
                {subscription.cancel_at_period_end && (
                  <p className="mt-1 text-xs text-red-700">Canceling at period end</p>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="font-mono text-[11px]">{subscription.stripe_customer_id}</p>
                <p className="mt-1 font-mono text-[11px]">{subscription.stripe_subscription_id}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tax: {subscription.automatic_tax_enabled ? subscription.automatic_tax_status ?? "enabled" : "off"}
                </p>
                {subscription.tax_country && (
                  <p className="mt-1 text-xs text-muted-foreground">Country: {subscription.tax_country}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="font-mono text-[11px]">{subscription.latest_invoice_id ?? "n/a"}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {subscription.latest_invoice_status ?? "n/a"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paid {formatCents(subscription.latest_invoice_amount_paid, subscription.latest_invoice_currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tax {formatCents(subscription.latest_invoice_amount_tax, subscription.latest_invoice_currency)}
                </p>
                {subscription.latest_payment_failed_at && (
                  <p className="mt-1 text-xs text-red-700">
                    Failed {formatDate(subscription.latest_payment_failed_at)}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium">
                  {lastGrant ? `+${lastGrant.amount} wishes` : "No grant"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lastGrant ? formatDate(lastGrant.created_at) : "n/a"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {lastGrant?.stripe_invoice_id ?? ""}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="text-xs">{lastEvent?.type ?? "n/a"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lastEvent ? formatDate(lastEvent.created_at) : "n/a"}
                </p>
                {lastEvent?.processing_error && (
                  <p className="mt-1 max-w-52 text-xs text-red-700">{lastEvent.processing_error}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

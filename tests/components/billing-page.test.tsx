import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BillingPage } from "@/components/billing/BillingPage"
import type { BillingSubscription, CreditTransaction } from "@/types"

vi.mock("@/app/actions/billing", () => ({
  openBillingPortal: vi.fn(),
  startBillingCheckout: vi.fn(),
}))

const subscription: BillingSubscription = {
  id: "billing-sub-1",
  account_id: "account-1",
  stripe_customer_id: "cus_123",
  stripe_subscription_id: "sub_123",
  stripe_price_id: "price_123",
  stripe_product_id: "prod_123",
  plan: "starter",
  billing_interval: "month",
  status: "active",
  monthly_wishes: 30,
  wishes_per_invoice: 30,
  current_period_start: "2026-06-01T00:00:00.000Z",
  current_period_end: "2026-07-01T00:00:00.000Z",
  cancel_at_period_end: false,
  cancel_at: null,
  canceled_at: null,
  latest_invoice_id: "in_123",
  latest_invoice_status: "paid",
  latest_invoice_amount_paid: 900,
  latest_invoice_amount_due: 900,
  latest_invoice_amount_tax: 80,
  latest_invoice_currency: "usd",
  latest_invoice_hosted_url: null,
  latest_payment_failed_at: null,
  latest_payment_error: null,
  automatic_tax_enabled: true,
  automatic_tax_status: "complete",
  tax_country: "US",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
}

const grant: CreditTransaction = {
  id: "tx-1",
  account_id: "account-1",
  user_id: "user-1",
  amount: 30,
  type: "subscription_grant",
  description: "Starter subscription wishes",
  stripe_session_id: null,
  stripe_invoice_id: "in_123",
  stripe_subscription_id: "sub_123",
  stripe_event_id: "evt_123",
  created_at: "2026-06-01T00:00:00.000Z",
}

describe("BillingPage", () => {
  it("shows the current subscription, renewal, tax mode, and last grant", () => {
    render(
      <BillingPage
        account={{ credit_balance: 42, plan: "starter" }}
        profile={{
          account_id: "account-1",
          stripe_customer_id: "cus_123",
          billing_email: "parent@example.com",
          billing_name: "Parent",
          billing_country: "US",
          billing_postal_code: "90210",
          tax_exempt: "none",
          tax_automatic_enabled: true,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        }}
        subscription={subscription}
        lastGrant={grant}
        userRole="owner"
        message={null}
        error={null}
      />
    )

    expect(screen.getByRole("heading", { name: "Billing" })).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getAllByText("Starter").length).toBeGreaterThan(0)
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("+30 wishes")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument()
  })

  it("keeps billing actions owner-only", () => {
    render(
      <BillingPage
        account={{ credit_balance: 5, plan: "free" }}
        profile={null}
        subscription={null}
        lastGrant={null}
        userRole="parent"
        message={null}
        error={null}
      />
    )

    expect(screen.getByText("Ask the account owner to change billing.")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /price not configured/i })[0]).toBeDisabled()
  })
})

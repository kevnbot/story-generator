import { describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"
import { handleStripeEvent } from "@/lib/billing/stripe-webhooks"

function createServiceMock() {
  const upserts: Array<{ table: string; payload: unknown }> = []
  const updates: Array<{ table: string; payload: unknown; column: string; value: unknown }> = []
  const rpc = vi.fn(async () => ({ data: true, error: null }))

  return {
    upserts,
    updates,
    rpc,
    service: {
      from(table: string) {
        return {
          upsert: vi.fn(async (payload: unknown) => {
            upserts.push({ table, payload })
            return { data: null, error: null }
          }),
          update: vi.fn((payload: unknown) => ({
            eq: vi.fn(async (column: string, value: unknown) => {
              updates.push({ table, payload, column, value })
              return { data: null, error: null }
            }),
          })),
        }
      },
      rpc,
    },
  }
}

function subscriptionFixture(): Stripe.Subscription {
  return {
    id: "sub_123",
    object: "subscription",
    customer: "cus_123",
    status: "active",
    currency: "usd",
    metadata: {
      account_id: "account-1",
      user_id: "user-1",
      plan: "starter",
      billing_interval: "month",
      monthly_wishes: "30",
    },
    automatic_tax: { enabled: true, liability: null, status: "complete" },
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    latest_invoice: "in_123",
    items: {
      object: "list",
      data: [{
        id: "si_123",
        object: "subscription_item",
        current_period_start: 1_780_272_000,
        current_period_end: 1_782_864_000,
        price: {
          id: "price_starter_month",
          object: "price",
          product: "prod_123",
          recurring: { interval: "month", interval_count: 1, meter: null, trial_period_days: null, usage_type: "licensed" },
          metadata: {},
        },
      }],
    },
  } as Stripe.Subscription
}

function invoiceFixture(): Stripe.Invoice {
  return {
    id: "in_123",
    object: "invoice",
    customer: "cus_123",
    customer_email: "parent@example.com",
    customer_name: "Parent",
    customer_address: { country: "US", postal_code: "90210", city: null, line1: null, line2: null, state: null },
    customer_tax_exempt: "none",
    status: "paid",
    amount_paid: 900,
    amount_due: 900,
    currency: "usd",
    hosted_invoice_url: "https://invoice.example",
    total_taxes: [{ amount: 80, tax_behavior: "exclusive", tax_rate_details: null, taxability_reason: "standard_rated", taxable_amount: 900, type: "tax_rate_details" }],
    automatic_tax: { enabled: true, liability: null, provider: null, status: "complete" },
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: {
        subscription: "sub_123",
        metadata: {
          account_id: "account-1",
          user_id: "user-1",
          plan: "starter",
          billing_interval: "month",
          monthly_wishes: "30",
        },
      },
    },
    lines: { object: "list", data: [] },
  } as Stripe.Invoice
}

describe("Stripe billing webhook handler", () => {
  it("grants subscription wishes once Stripe reports a paid invoice", async () => {
    const { service, rpc, upserts, updates } = createServiceMock()
    const stripe = {
      subscriptions: {
        retrieve: vi.fn(async () => subscriptionFixture()),
      },
    } as unknown as Stripe
    const event = {
      id: "evt_123",
      type: "invoice.paid",
      livemode: false,
      api_version: "2026-05-27.dahlia",
      data: { object: invoiceFixture() },
    } as Stripe.Event

    await handleStripeEvent(event, stripe, service as never)

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123", {
      expand: ["items.data.price"],
    })
    expect(rpc).toHaveBeenCalledWith("grant_subscription_wishes", {
      p_account_id: "account-1",
      p_user_id: "user-1",
      p_amount: 30,
      p_description: "Starter subscription wishes",
      p_stripe_invoice_id: "in_123",
      p_stripe_subscription_id: "sub_123",
      p_stripe_event_id: "evt_123",
    })
    expect(upserts.some((entry) => entry.table === "billing_subscriptions")).toBe(true)
    expect(updates.some((entry) => entry.table === "accounts")).toBe(true)
    expect(upserts.filter((entry) => entry.table === "stripe_events")).toHaveLength(2)
  })
})

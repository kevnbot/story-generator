import { beforeEach, describe, expect, it, vi } from "vitest"

const constructEventMock = vi.fn()
const handleStripeEventMock = vi.fn()

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
  }),
}))

vi.mock("@/lib/billing/stripe-webhooks", () => ({
  handleStripeEvent: handleStripeEventMock,
}))

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    constructEventMock.mockReset()
    handleStripeEventMock.mockReset()
  })

  it("rejects requests without a valid Stripe signature", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature")
    })
    const { POST } = await import("@/app/api/stripe/webhook/route")

    const response = await POST(new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "bad" },
      body: "{}",
    }))

    expect(response.status).toBe(400)
    expect(handleStripeEventMock).not.toHaveBeenCalled()
  })

  it("passes verified events to the billing webhook handler", async () => {
    const event = { id: "evt_1", type: "invoice.paid", data: { object: { id: "in_1" } } }
    constructEventMock.mockReturnValue(event)
    handleStripeEventMock.mockResolvedValue(undefined)
    const { POST } = await import("@/app/api/stripe/webhook/route")

    const response = await POST(new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: "{}",
    }))

    await expect(response.json()).resolves.toEqual({ received: true })
    expect(handleStripeEventMock).toHaveBeenCalledWith(event, expect.any(Object))
  })
})

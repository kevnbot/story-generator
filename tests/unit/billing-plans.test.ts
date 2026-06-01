import { afterEach, describe, expect, it, vi } from "vitest"
import {
  findBillingOptionByPriceId,
  formatMoney,
  getBillingPlanOption,
  getWishesPerInvoice,
} from "@/lib/billing/plans"

describe("billing plan configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("calculates monthly and yearly wish grants", () => {
    expect(getWishesPerInvoice("starter", "month")).toBe(30)
    expect(getWishesPerInvoice("starter", "year")).toBe(360)
    expect(getWishesPerInvoice("family", "month")).toBe(90)
    expect(getWishesPerInvoice("family", "year")).toBe(1080)
  })

  it("marks options unconfigured until Stripe price ids are present", () => {
    expect(getBillingPlanOption("starter", "month")).toMatchObject({
      priceId: null,
      configured: false,
      amount: 900,
      wishesGranted: 30,
    })
  })

  it("maps configured Stripe price ids back to internal plan options", () => {
    vi.stubEnv("STRIPE_PRICE_FAMILY_YEARLY", "price_family_year")

    expect(findBillingOptionByPriceId("price_family_year")).toMatchObject({
      interval: "year",
      wishesGranted: 1080,
      plan: expect.objectContaining({ id: "family" }),
    })
  })

  it("formats USD prices for plan display", () => {
    expect(formatMoney(900)).toBe("$9")
    expect(formatMoney(19000)).toBe("$190")
  })
})

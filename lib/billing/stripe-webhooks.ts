import type Stripe from "stripe"
import { createServiceClient } from "@/lib/supabase/server"
import {
  findBillingOptionByPriceId,
  getWishesPerInvoice,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plans"
import { getStripe } from "@/lib/billing/stripe"

type ServiceClient = ReturnType<typeof createServiceClient>

type ResolvedSubscription = {
  accountId: string
  customerId: string
  subscriptionId: string
  priceId: string | null
  productId: string | null
  plan: BillingPlanId
  interval: BillingInterval
  monthlyWishes: number
  wishesPerInvoice: number
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  cancelAt: string | null
  canceledAt: string | null
  automaticTaxEnabled: boolean
  automaticTaxStatus: string | null
}

function objectId(value: string | { id: string } | null | undefined) {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

function timestampToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null
}

function sumInvoiceTax(invoice: Stripe.Invoice) {
  return invoice.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? 0
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  if (invoice.parent?.type === "subscription_details") {
    return objectId(invoice.parent.subscription_details?.subscription)
  }

  const line = invoice.lines?.data.find((item) => item.subscription)
  return objectId(line?.subscription)
}

function subscriptionMetadataFromInvoice(invoice: Stripe.Invoice) {
  if (invoice.parent?.type === "subscription_details") {
    return invoice.parent.subscription_details?.metadata ?? null
  }
  return null
}

function resolvePlanFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const plan = metadata?.plan
  const interval = metadata?.billing_interval
  const monthlyWishes = Number(metadata?.monthly_wishes)

  if (!plan || !interval || !isBillingPlanId(plan) || !isBillingInterval(interval)) return null

  return {
    plan,
    interval,
    monthlyWishes: Number.isFinite(monthlyWishes) && monthlyWishes > 0
      ? monthlyWishes
      : getWishesPerInvoice(plan, "month"),
    wishesPerInvoice: getWishesPerInvoice(plan, interval),
  }
}

function resolvePlanFromPrice(price: Stripe.Price, metadata?: Stripe.Metadata | null) {
  const configuredOption = findBillingOptionByPriceId(price.id)
  if (configuredOption) {
    return {
      plan: configuredOption.plan.id,
      interval: configuredOption.interval,
      monthlyWishes: configuredOption.plan.monthlyWishes,
      wishesPerInvoice: configuredOption.wishesGranted,
    }
  }

  return resolvePlanFromMetadata(metadata) ?? resolvePlanFromMetadata(price.metadata)
}

async function findAccountId(
  service: ServiceClient,
  params: {
    accountId?: string | null
    customerId?: string | null
    subscriptionId?: string | null
    sessionId?: string | null
  }
) {
  if (params.accountId) return params.accountId

  if (params.subscriptionId) {
    const { data } = await service
      .from("billing_subscriptions")
      .select("account_id")
      .eq("stripe_subscription_id", params.subscriptionId)
      .maybeSingle()
    if (data?.account_id) return data.account_id as string
  }

  if (params.sessionId) {
    const { data } = await service
      .from("billing_checkout_sessions")
      .select("account_id")
      .eq("stripe_session_id", params.sessionId)
      .maybeSingle()
    if (data?.account_id) return data.account_id as string
  }

  if (params.customerId) {
    const { data } = await service
      .from("account_billing_profiles")
      .select("account_id")
      .eq("stripe_customer_id", params.customerId)
      .maybeSingle()
    if (data?.account_id) return data.account_id as string
  }

  return null
}

async function findGrantUserId(
  service: ServiceClient,
  accountId: string,
  params: { userId?: string | null; subscriptionId?: string | null }
) {
  if (params.userId) return params.userId

  if (params.subscriptionId) {
    const { data } = await service
      .from("billing_checkout_sessions")
      .select("user_id")
      .eq("account_id", accountId)
      .eq("stripe_subscription_id", params.subscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.user_id) return data.user_id as string
  }

  const { data } = await service
    .from("users")
    .select("id")
    .eq("account_id", accountId)
    .eq("role", "owner")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data?.id as string | undefined) ?? null
}

async function upsertStripeEvent(
  service: ServiceClient,
  event: Stripe.Event,
  refs: {
    accountId?: string | null
    objectId?: string | null
    customerId?: string | null
    subscriptionId?: string | null
    invoiceId?: string | null
    processingError?: string | null
    processedAt?: string | null
  }
) {
  await service.from("stripe_events").upsert({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    api_version: event.api_version ?? null,
    object_id: refs.objectId ?? null,
    account_id: refs.accountId ?? null,
    stripe_customer_id: refs.customerId ?? null,
    stripe_subscription_id: refs.subscriptionId ?? null,
    stripe_invoice_id: refs.invoiceId ?? null,
    processing_error: refs.processingError ?? null,
    processed_at: refs.processedAt ?? null,
  })
}

async function upsertBillingProfile(
  service: ServiceClient,
  accountId: string,
  params: {
    customerId: string
    email?: string | null
    name?: string | null
    country?: string | null
    postalCode?: string | null
    taxExempt?: string | null
    automaticTaxEnabled?: boolean
  }
) {
  await service.from("account_billing_profiles").upsert({
    account_id: accountId,
    stripe_customer_id: params.customerId,
    billing_email: params.email ?? null,
    billing_name: params.name ?? null,
    billing_country: params.country ?? null,
    billing_postal_code: params.postalCode ?? null,
    tax_exempt: params.taxExempt ?? null,
    tax_automatic_enabled: params.automaticTaxEnabled ?? false,
    updated_at: new Date().toISOString(),
  })
}

function resolveSubscription(subscription: Stripe.Subscription, accountId: string): ResolvedSubscription {
  const item = subscription.items.data[0]
  if (!item) {
    throw new Error(`Subscription ${subscription.id} has no subscription items`)
  }

  const price = item.price
  const plan = resolvePlanFromPrice(price, subscription.metadata)
  if (!plan) {
    throw new Error(`Subscription ${subscription.id} price ${price.id} is not a configured billing plan`)
  }

  return {
    accountId,
    customerId: objectId(subscription.customer) ?? "",
    subscriptionId: subscription.id,
    priceId: price.id,
    productId: objectId(price.product),
    plan: plan.plan,
    interval: plan.interval,
    monthlyWishes: plan.monthlyWishes,
    wishesPerInvoice: plan.wishesPerInvoice,
    status: subscription.status,
    currentPeriodStart: timestampToIso(item.current_period_start),
    currentPeriodEnd: timestampToIso(item.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: timestampToIso(subscription.cancel_at),
    canceledAt: timestampToIso(subscription.canceled_at),
    automaticTaxEnabled: subscription.automatic_tax.enabled,
    automaticTaxStatus: null,
  }
}

async function upsertSubscription(
  service: ServiceClient,
  subscription: Stripe.Subscription,
  accountId: string,
  invoice?: Stripe.Invoice
) {
  const resolved = resolveSubscription(subscription, accountId)

  await service.from("billing_subscriptions").upsert({
    account_id: resolved.accountId,
    stripe_customer_id: resolved.customerId,
    stripe_subscription_id: resolved.subscriptionId,
    stripe_price_id: resolved.priceId,
    stripe_product_id: resolved.productId,
    plan: resolved.plan,
    billing_interval: resolved.interval,
    status: resolved.status,
    monthly_wishes: resolved.monthlyWishes,
    wishes_per_invoice: resolved.wishesPerInvoice,
    current_period_start: resolved.currentPeriodStart,
    current_period_end: resolved.currentPeriodEnd,
    cancel_at_period_end: resolved.cancelAtPeriodEnd,
    cancel_at: resolved.cancelAt,
    canceled_at: resolved.canceledAt,
    latest_invoice_id: invoice?.id ?? objectId(subscription.latest_invoice),
    latest_invoice_status: invoice?.status ?? null,
    latest_invoice_amount_paid: invoice?.amount_paid ?? null,
    latest_invoice_amount_due: invoice?.amount_due ?? null,
    latest_invoice_amount_tax: invoice ? sumInvoiceTax(invoice) : null,
    latest_invoice_currency: invoice?.currency ?? subscription.currency ?? null,
    latest_invoice_hosted_url: invoice?.hosted_invoice_url ?? null,
    automatic_tax_enabled: resolved.automaticTaxEnabled,
    automatic_tax_status: invoice?.automatic_tax.status ?? resolved.automaticTaxStatus,
    tax_country: invoice?.customer_address?.country ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" })

  await service
    .from("accounts")
    .update({ plan: resolved.status === "active" || resolved.status === "trialing" ? resolved.plan : "free" })
    .eq("id", resolved.accountId)

  return resolved
}

async function retrieveSubscription(stripe: Stripe, subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  })
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  service: ServiceClient
) {
  const customerId = objectId(session.customer)
  const subscriptionId = objectId(session.subscription)
  const accountId = await findAccountId(service, {
    accountId: session.metadata?.account_id ?? session.client_reference_id,
    customerId,
    subscriptionId,
    sessionId: session.id,
  })

  if (!accountId) throw new Error(`Unable to resolve account for checkout session ${session.id}`)
  if (!customerId) throw new Error(`Checkout session ${session.id} has no customer`)

  await service
    .from("billing_checkout_sessions")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: session.status ?? "complete",
      tax_amount: session.total_details?.amount_tax ?? null,
      currency: session.currency ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id)

  await upsertBillingProfile(service, accountId, {
    customerId,
    email: session.customer_details?.email,
    name: session.customer_details?.name,
    country: session.customer_details?.address?.country,
    postalCode: session.customer_details?.address?.postal_code,
    taxExempt: session.customer_details?.tax_exempt,
    automaticTaxEnabled: session.automatic_tax.enabled,
  })

  if (subscriptionId) {
    const subscription = await retrieveSubscription(stripe, subscriptionId)
    await upsertSubscription(service, subscription, accountId)
  }

  return { accountId, customerId, subscriptionId }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  service: ServiceClient
) {
  const customerId = objectId(subscription.customer)
  const accountId = await findAccountId(service, {
    accountId: subscription.metadata?.account_id,
    customerId,
    subscriptionId: subscription.id,
  })

  if (!accountId) throw new Error(`Unable to resolve account for subscription ${subscription.id}`)

  const resolved = await upsertSubscription(service, subscription, accountId)
  return { accountId, customerId, subscriptionId: subscription.id, resolved }
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  eventId: string,
  stripe: Stripe,
  service: ServiceClient
) {
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) {
    return { accountId: null, customerId: objectId(invoice.customer), subscriptionId: null, granted: false }
  }

  const subscription = await retrieveSubscription(stripe, subscriptionId)
  const metadata = subscriptionMetadataFromInvoice(invoice) ?? subscription.metadata
  const customerId = objectId(invoice.customer) ?? objectId(subscription.customer)
  const accountId = await findAccountId(service, {
    accountId: metadata?.account_id,
    customerId,
    subscriptionId,
  })

  if (!accountId) throw new Error(`Unable to resolve account for invoice ${invoice.id}`)
  if (!customerId) throw new Error(`Invoice ${invoice.id} has no customer`)

  await upsertBillingProfile(service, accountId, {
    customerId,
    email: invoice.customer_email,
    name: invoice.customer_name,
    country: invoice.customer_address?.country,
    postalCode: invoice.customer_address?.postal_code,
    taxExempt: invoice.customer_tax_exempt,
    automaticTaxEnabled: invoice.automatic_tax.enabled,
  })

  const resolved = await upsertSubscription(service, subscription, accountId, invoice)
  const grantUserId = await findGrantUserId(service, accountId, {
    userId: metadata?.user_id,
    subscriptionId,
  })
  if (!grantUserId) throw new Error(`Unable to resolve grant user for account ${accountId}`)

  const { data, error } = await service.rpc("grant_subscription_wishes", {
    p_account_id: accountId,
    p_user_id: grantUserId,
    p_amount: resolved.wishesPerInvoice,
    p_description: `${resolved.plan === "family" ? "Family" : "Starter"} subscription wishes`,
    p_stripe_invoice_id: invoice.id,
    p_stripe_subscription_id: subscriptionId,
    p_stripe_event_id: eventId,
  })

  if (error) throw new Error(error.message ?? `Failed to grant wishes for invoice ${invoice.id}`)

  return { accountId, customerId, subscriptionId, granted: Boolean(data), resolved }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, service: ServiceClient) {
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  const customerId = objectId(invoice.customer)
  const accountId = await findAccountId(service, {
    accountId: subscriptionMetadataFromInvoice(invoice)?.account_id,
    customerId,
    subscriptionId,
  })

  if (!accountId || !subscriptionId) {
    return { accountId, customerId, subscriptionId }
  }

  await service
    .from("billing_subscriptions")
    .update({
      latest_invoice_id: invoice.id,
      latest_invoice_status: invoice.status,
      latest_invoice_amount_paid: invoice.amount_paid,
      latest_invoice_amount_due: invoice.amount_due,
      latest_invoice_amount_tax: sumInvoiceTax(invoice),
      latest_invoice_currency: invoice.currency,
      latest_invoice_hosted_url: invoice.hosted_invoice_url ?? null,
      latest_payment_failed_at: new Date().toISOString(),
      latest_payment_error: invoice.last_finalization_error?.message ?? null,
      automatic_tax_status: invoice.automatic_tax.status,
      tax_country: invoice.customer_address?.country ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId)

  return { accountId, customerId, subscriptionId }
}

export async function handleStripeEvent(
  event: Stripe.Event,
  stripe: Stripe = getStripe(),
  service: ServiceClient = createServiceClient()
) {
  const object = event.data.object as { id?: string }
  let refs: {
    accountId?: string | null
    customerId?: string | null
    subscriptionId?: string | null
    invoiceId?: string | null
  } = {}

  await upsertStripeEvent(service, event, {
    objectId: object.id ?? null,
  })

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        refs = await handleCheckoutSessionCompleted(session, stripe, service)
        break
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        refs = { invoiceId: invoice.id, ...(await handleInvoicePaid(invoice, event.id, stripe, service)) }
        break
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        refs = { invoiceId: invoice.id, ...(await handleInvoicePaymentFailed(invoice, service)) }
        break
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        refs = await handleSubscriptionUpdated(subscription, service)
        break
      }
      default:
        break
    }

    await upsertStripeEvent(service, event, {
      objectId: object.id ?? null,
      ...refs,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    await upsertStripeEvent(service, event, {
      objectId: object.id ?? null,
      ...refs,
      processingError: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

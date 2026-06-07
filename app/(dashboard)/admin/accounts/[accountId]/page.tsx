import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { createSignedImageUrlsMap } from "@/lib/storage/images"
import {
  AccountCharacterGrid,
  type AccountCharacter,
} from "@/components/admin/accounts/AccountCharacterGrid"
import {
  AccountStoriesTable,
  type AccountStoryRow,
} from "@/components/admin/accounts/AccountStoriesTable"
import type { BillingSubscription, KidProfile } from "@/types"

export const metadata = {
  title: "Account | Admin",
}

type AccountRow = {
  id: string
  name: string
  credit_balance: number
  plan: string
  created_at: string
}

type OwnerRow = {
  display_name: string | null
  email: string
  created_at: string
  avatar_url: string | null
}

type StoryRow = {
  id: string
  title: string
  created_at: string
  has_images: boolean
  kid_profile_id: string | null
}

const PROFILE_SELECT =
  "id, account_id, name, age, age_months, gender, appearance, personality_tags, toy, prompt_summary, " +
  "reference_image_path, reference_image_url, " +
  "character_illustration_path, character_illustration_url, " +
  "toy_reference_image_path, toy_reference_image_url, " +
  "combined_reference_path, combined_reference_url, " +
  "illustration_status, illustration_error, deleted_at, created_at, updated_at"

function formatDate(value: string | null) {
  if (!value) return "n/a"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function formatCents(value: number | null, currency: string | null) {
  if (value == null) return "n/a"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
  }).format(value / 100)
}

export default async function AdminAccountDetailPage(props: {
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = await props.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isPlatformAdmin(user.id))) redirect("/generate")

  const service = createServiceClient()

  const { data: accountData } = await service
    .from("accounts")
    .select("id, name, credit_balance, plan, created_at")
    .eq("id", accountId)
    .maybeSingle()

  if (!accountData) notFound()
  const account = accountData as AccountRow

  const [ownersResult, profilesResult, subscriptionResult, storiesResult] = await Promise.all([
    service
      .from("users")
      .select("display_name, email, created_at, avatar_url")
      .eq("account_id", accountId)
      .eq("role", "owner")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    service
      .from("kid_profiles")
      .select(PROFILE_SELECT)
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    service
      .from("billing_subscriptions")
      .select("*")
      .eq("account_id", accountId)
      .order("updated_at", { ascending: false })
      .limit(1),
    service
      .from("stories")
      .select("id, title, created_at, has_images, kid_profile_id")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  const owner = ((ownersResult.data ?? []) as OwnerRow[])[0] ?? null
  const profileRows = (profilesResult.data ?? []) as unknown as KidProfile[]
  const subscription = ((subscriptionResult.data ?? []) as BillingSubscription[])[0] ?? null
  const storyRows = (storiesResult.data ?? []) as StoryRow[]

  // Resolve character image URLs (signed) with the same fallback chain as /profiles.
  const pathsToSign = profileRows
    .flatMap((p) => [
      p.combined_reference_path,
      p.character_illustration_path,
      p.reference_image_path,
    ])
    .filter((p): p is string => Boolean(p))
  const signedUrlsByPath = await createSignedImageUrlsMap(service, pathsToSign)

  function signedOrFallback(path: string | null | undefined, fallback: string | null | undefined) {
    return (path && signedUrlsByPath.get(path)) ?? fallback ?? null
  }

  const characters: AccountCharacter[] = profileRows.map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    age_months: p.age_months ?? null,
    personality_tags: p.personality_tags ?? null,
    toy: p.toy ?? null,
    illustration_status: p.illustration_status ?? null,
    avatarUrl:
      signedOrFallback(p.combined_reference_path, null) ??
      signedOrFallback(p.character_illustration_path, null) ??
      signedOrFallback(p.reference_image_path, p.reference_image_url),
  }))

  const characterNames = new Map(profileRows.map((p) => [p.id, p.name]))
  const stories: AccountStoryRow[] = storyRows.map((s) => ({
    id: s.id,
    title: s.title,
    has_images: s.has_images,
    created_at: s.created_at,
    characterName: s.kid_profile_id ? characterNames.get(s.kid_profile_id) ?? null : null,
  }))

  const ownerName = owner?.display_name || owner?.email || "—"
  const signedUpAt = owner?.created_at ?? account.created_at

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin/accounts"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to accounts
      </Link>

      {/* Overview */}
      <div className="mt-3 mb-8">
        <h1 className="font-serif text-2xl font-semibold text-foreground">{account.name}</h1>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{account.id}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Owner */}
          <div className="rounded-lg border border-nav-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</p>
            <p className="mt-1 font-medium text-foreground">{ownerName}</p>
            {owner?.email && owner.email !== ownerName && (
              <p className="text-sm text-muted-foreground">{owner.email}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Signed up {formatDate(signedUpAt)}</p>
          </div>

          {/* Plan + wishes */}
          <div className="rounded-lg border border-nav-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan</p>
            <p className="mt-1 font-medium capitalize text-foreground">{account.plan}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wishes
            </p>
            <p className="mt-1 font-medium text-genie-gold-800">{account.credit_balance} wishes</p>
          </div>

          {/* Billing */}
          <div className="rounded-lg border border-nav-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing</p>
            {subscription ? (
              <div className="mt-1 space-y-1">
                <p className="font-medium capitalize text-foreground">
                  {subscription.plan} · <span className="capitalize">{subscription.status}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscription.monthly_wishes}/mo · {subscription.billing_interval}
                </p>
                <p className="text-xs text-muted-foreground">
                  Renews {formatDate(subscription.current_period_end)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last invoice:{" "}
                  {formatCents(
                    subscription.latest_invoice_amount_paid,
                    subscription.latest_invoice_currency,
                  )}{" "}
                  {subscription.latest_invoice_status && `(${subscription.latest_invoice_status})`}
                </p>
                {subscription.cancel_at_period_end && (
                  <p className="text-xs text-red-700">Canceling at period end</p>
                )}
                {subscription.latest_payment_failed_at && (
                  <p className="text-xs text-red-700">
                    Payment failed {formatDate(subscription.latest_payment_failed_at)}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No active subscription (free plan)</p>
            )}
          </div>
        </div>
      </div>

      {/* Characters */}
      <div className="mb-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">
          Characters ({characters.length})
        </h2>
        <AccountCharacterGrid profiles={characters} />
      </div>

      {/* Stories */}
      <div>
        <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">
          Stories ({stories.length})
        </h2>
        <AccountStoriesTable stories={stories} />
      </div>
    </div>
  )
}

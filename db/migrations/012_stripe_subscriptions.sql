-- Stripe subscriptions for account-scoped monthly wishes.

alter table credit_transactions
  drop constraint if exists credit_transactions_type_check;

alter table credit_transactions
  add constraint credit_transactions_type_check
  check (type in ('purchase','spend','refund','promo','subscription_grant'));

alter table credit_transactions
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_event_id text;

create unique index if not exists idx_credit_tx_subscription_invoice_once
  on credit_transactions(stripe_invoice_id)
  where type = 'subscription_grant' and stripe_invoice_id is not null;

create table if not exists account_billing_profiles (
  account_id uuid primary key references accounts(id) on delete cascade,
  stripe_customer_id text not null unique,
  billing_email text,
  billing_name text,
  billing_country text,
  billing_postal_code text,
  tax_exempt text,
  tax_automatic_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_checkout_sessions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null check (plan in ('starter','family')),
  billing_interval text not null check (billing_interval in ('month','year')),
  stripe_price_id text not null,
  monthly_wishes integer not null check (monthly_wishes > 0),
  wishes_granted integer not null check (wishes_granted > 0),
  status text not null default 'open',
  mode text not null default 'subscription',
  automatic_tax_enabled boolean not null default false,
  tax_amount integer,
  currency text,
  success_url text not null,
  cancel_url text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists billing_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  stripe_product_id text,
  plan text not null check (plan in ('starter','family')),
  billing_interval text not null check (billing_interval in ('month','year')),
  status text not null,
  monthly_wishes integer not null check (monthly_wishes > 0),
  wishes_per_invoice integer not null check (wishes_per_invoice > 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancel_at timestamptz,
  canceled_at timestamptz,
  latest_invoice_id text,
  latest_invoice_status text,
  latest_invoice_amount_paid integer,
  latest_invoice_amount_due integer,
  latest_invoice_amount_tax integer,
  latest_invoice_currency text,
  latest_invoice_hosted_url text,
  latest_payment_failed_at timestamptz,
  latest_payment_error text,
  automatic_tax_enabled boolean not null default false,
  automatic_tax_status text,
  tax_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null default false,
  api_version text,
  object_id text,
  account_id uuid references accounts(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_checkout_sessions_account
  on billing_checkout_sessions(account_id, created_at desc);

create index if not exists idx_billing_checkout_sessions_user
  on billing_checkout_sessions(user_id, created_at desc);

create index if not exists idx_billing_subscriptions_account
  on billing_subscriptions(account_id, updated_at desc);

create unique index if not exists idx_billing_subscriptions_one_active_per_account
  on billing_subscriptions(account_id)
  where status in ('trialing','active','past_due','unpaid','paused');

create index if not exists idx_stripe_events_account
  on stripe_events(account_id, created_at desc);

create index if not exists idx_stripe_events_subscription
  on stripe_events(stripe_subscription_id, created_at desc);

alter table account_billing_profiles enable row level security;
alter table billing_checkout_sessions enable row level security;
alter table billing_subscriptions enable row level security;
alter table stripe_events enable row level security;

create policy "account read billing profile"
  on account_billing_profiles for select
  using (account_id = get_my_account_id());

create policy "account read checkout sessions"
  on billing_checkout_sessions for select
  using (account_id = get_my_account_id());

create policy "account read billing subscriptions"
  on billing_subscriptions for select
  using (account_id = get_my_account_id());

-- stripe_events is intentionally service-role/admin only.

create or replace function grant_subscription_wishes(
  p_account_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_stripe_invoice_id text,
  p_stripe_subscription_id text,
  p_stripe_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'subscription grant amount must be positive';
  end if;

  if exists (
    select 1
    from credit_transactions
    where type = 'subscription_grant'
      and stripe_invoice_id = p_stripe_invoice_id
  ) then
    return false;
  end if;

  update accounts
  set credit_balance = credit_balance + p_amount
  where id = p_account_id;

  insert into credit_transactions (
    account_id,
    user_id,
    amount,
    type,
    description,
    stripe_invoice_id,
    stripe_subscription_id,
    stripe_event_id
  )
  values (
    p_account_id,
    p_user_id,
    p_amount,
    'subscription_grant',
    p_description,
    p_stripe_invoice_id,
    p_stripe_subscription_id,
    p_stripe_event_id
  );

  return true;
end;
$$;

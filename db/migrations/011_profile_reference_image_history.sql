create table profile_reference_image_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references kid_profiles(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  image_type text not null check (image_type in ('character', 'toy', 'combined')),
  image_path text,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index idx_profile_reference_history_profile_id
  on profile_reference_image_history(profile_id, image_type, created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table profile_reference_image_history enable row level security;

-- history rows — scoped to account; append-only (no update or delete policies)
create policy "account read profile reference history"
  on profile_reference_image_history for select
  using (account_id = get_my_account_id());

create policy "account insert profile reference history"
  on profile_reference_image_history for insert
  with check (account_id = get_my_account_id());

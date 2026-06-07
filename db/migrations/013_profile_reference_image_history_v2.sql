-- Add profile snapshot so we can restore field values alongside a previous image
alter table profile_reference_image_history
  add column if not exists profile_snapshot jsonb;

-- Active image tracking: which history row is currently "live"
alter table profile_reference_image_history
  add column if not exists is_active boolean not null default false,
  add column if not exists activation_count integer not null default 0,
  add column if not exists last_activated_at timestamptz;

-- Index for efficiently finding the active row per profile + type
create index if not exists idx_profile_ref_history_active
  on profile_reference_image_history(profile_id, image_type, is_active)
  where is_active = true;

-- Allow account members to update history rows (needed for is_active toggling via anon client)
create policy "account update profile reference history"
  on profile_reference_image_history for update
  using (account_id = get_my_account_id());

-- Reference columns for credit_transactions (used by profile regeneration)
alter table credit_transactions
  add column if not exists reference_type text,
  add column if not exists reference_id uuid;

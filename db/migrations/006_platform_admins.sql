-- Platform-wide admin membership for internal staff tooling.
-- Separate from tenant-scoped users.role (owner/parent/viewer).
create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_platform_admins_revoked_at
  on platform_admins(revoked_at);

alter table platform_admins enable row level security;

create policy "platform admins can read own active row"
  on platform_admins for select
  using (auth.uid() is not null and auth.uid() = user_id and revoked_at is null);

-- ============================================================
-- Story Generator — Full Database Migration
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── accounts ────────────────────────────────────────────────────────────────
create table if not exists accounts (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null default 'My Family',
  credit_balance integer not null default 0 check (credit_balance >= 0),
  plan          text not null default 'free' check (plan in ('free','starter','family')),
  created_at    timestamptz not null default now()
);

-- ─── users ───────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users — one row per authenticated user
create table if not exists users (
  id              uuid primary key references auth.users(id) on delete cascade,
  account_id      uuid not null references accounts(id) on delete cascade,
  email           text not null,
  role            text not null default 'owner' check (role in ('owner','parent','viewer')),
  display_name    text,
  avatar_url      text,
  auth_provider   text not null default 'email' check (auth_provider in ('email','google','apple')),
  phone_number    text,
  phone_verified  boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── notification_preferences ────────────────────────────────────────────────
create table if not exists notification_preferences (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null unique references users(id) on delete cascade,
  email_transactional   boolean not null default true,
  email_marketing       boolean not null default false,
  sms_transactional     boolean not null default false,
  sms_marketing         boolean not null default false,
  sms_2fa               boolean not null default false,
  consent_recorded_at   timestamptz,
  consent_ip            text,
  updated_at            timestamptz not null default now()
);

-- ─── kid_profiles ────────────────────────────────────────────────────────────
create table if not exists kid_profiles (
  id                uuid primary key default uuid_generate_v4(),
  account_id        uuid not null references accounts(id) on delete cascade,
  name              text not null,
  age               integer not null check (age between 1 and 17),
  appearance        jsonb not null default '{}',
  personality_tags  text[] not null default '{}',
  toy               jsonb not null default '{}',
  prompt_summary    text not null default '',
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── story_templates ─────────────────────────────────────────────────────────
create table if not exists story_templates (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  description             text not null default '',
  system_prompt           text not null,
  user_prompt_template    text not null,
  image_prompt_template   text not null,
  credits_cost            integer not null default 10 check (credits_cost > 0),
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);

-- ─── generation_jobs ─────────────────────────────────────────────────────────
create table if not exists generation_jobs (
  id                  uuid primary key default uuid_generate_v4(),
  account_id          uuid not null references accounts(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  kid_profile_id      uuid not null references kid_profiles(id) on delete cascade,
  story_template_id   uuid not null references story_templates(id),
  status              text not null default 'pending' check (status in ('pending','generating','complete','failed')),
  credits_held        integer not null default 0,
  error_message       text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- ─── stories ─────────────────────────────────────────────────────────────────
create table if not exists stories (
  id                  uuid primary key default uuid_generate_v4(),
  account_id          uuid not null references accounts(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  kid_profile_id      uuid references kid_profiles(id) on delete set null,
  story_template_id   uuid references story_templates(id) on delete set null,
  job_id              uuid references generation_jobs(id) on delete set null,
  title               text not null,
  content             text not null,
  images              jsonb not null default '[]',
  generation_params   jsonb not null default '{}',
  credits_used        integer not null default 0,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- ─── credit_transactions ─────────────────────────────────────────────────────
create table if not exists credit_transactions (
  id                uuid primary key default uuid_generate_v4(),
  account_id        uuid not null references accounts(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  amount            integer not null,
  type              text not null check (type in ('purchase','spend','refund','promo')),
  description       text,
  stripe_session_id text,
  created_at        timestamptz not null default now()
);

-- ─── comms_log ───────────────────────────────────────────────────────────────
create table if not exists comms_log (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references users(id) on delete cascade,
  channel               text not null check (channel in ('email','sms')),
  type                  text not null check (type in ('transactional','marketing','2fa')),
  template_id           text,
  recipient             text not null,
  status                text not null default 'sent' check (status in ('sent','delivered','failed','bounced','opted_out')),
  provider_message_id   text,
  error_message         text,
  sent_at               timestamptz not null default now()
);

-- ─── app_config ──────────────────────────────────────────────────────────────
create table if not exists app_config (
  id          uuid primary key default uuid_generate_v4(),
  key         text not null unique,
  value       text not null,
  description text not null default '',
  updated_at  timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_users_account_id        on users(account_id);
create index if not exists idx_users_email             on users(email);
create index if not exists idx_kid_profiles_account_id on kid_profiles(account_id);
create index if not exists idx_kid_profiles_deleted_at on kid_profiles(deleted_at);
create index if not exists idx_generation_jobs_account on generation_jobs(account_id);
create index if not exists idx_generation_jobs_status  on generation_jobs(status);
create index if not exists idx_stories_account_id      on stories(account_id);
create index if not exists idx_stories_profile_id      on stories(kid_profile_id);
create index if not exists idx_stories_deleted_at      on stories(deleted_at);
create index if not exists idx_credit_tx_account_id    on credit_transactions(account_id);
create index if not exists idx_comms_log_user_id       on comms_log(user_id);
create index if not exists idx_comms_log_channel       on comms_log(channel);
create index if not exists idx_comms_log_sent_at       on comms_log(sent_at);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table accounts                  enable row level security;
alter table users                     enable row level security;
alter table notification_preferences  enable row level security;
alter table kid_profiles              enable row level security;
alter table story_templates           enable row level security;
alter table generation_jobs           enable row level security;
alter table stories                   enable row level security;
alter table credit_transactions       enable row level security;
alter table comms_log                 enable row level security;
alter table app_config                enable row level security;

-- Helper: get calling user's account_id
create or replace function get_my_account_id()
returns uuid language sql security definer stable as $$
  select account_id from users where id = auth.uid()
$$;

-- accounts — users can read/update their own account
create policy "users read own account"
  on accounts for select using (id = get_my_account_id());
create policy "owner update account"
  on accounts for update using (
    id = get_my_account_id() and
    exists (select 1 from users where id = auth.uid() and role = 'owner')
  );

-- users — members can read others in same account
create policy "users read same account"
  on users for select using (account_id = get_my_account_id());
create policy "users update own row"
  on users for update using (id = auth.uid());

-- notification_preferences — own row only
create policy "read own prefs"
  on notification_preferences for select using (user_id = auth.uid());
create policy "update own prefs"
  on notification_preferences for update using (user_id = auth.uid());

-- kid_profiles — scoped to account, exclude soft-deleted
create policy "account read profiles"
  on kid_profiles for select
  using (account_id = get_my_account_id() and deleted_at is null);
create policy "account insert profiles"
  on kid_profiles for insert with check (account_id = get_my_account_id());
create policy "account update profiles"
  on kid_profiles for update using (account_id = get_my_account_id());

-- story_templates — readable by all authenticated users
create policy "authenticated read templates"
  on story_templates for select using (auth.uid() is not null and is_active = true);

-- generation_jobs — scoped to account
create policy "account read jobs"
  on generation_jobs for select using (account_id = get_my_account_id());

-- stories — scoped to account, exclude soft-deleted
create policy "account read stories"
  on stories for select
  using (account_id = get_my_account_id() and deleted_at is null);
create policy "account update stories"
  on stories for update using (account_id = get_my_account_id());

-- credit_transactions — scoped to account
create policy "account read transactions"
  on credit_transactions for select using (account_id = get_my_account_id());

-- comms_log — own user only
create policy "read own comms"
  on comms_log for select using (user_id = auth.uid());

-- app_config — no direct user access (service role only)
-- Admin reads handled server-side with service role key

-- ─── Seed: default app_config values ─────────────────────────────────────────
insert into app_config (key, value, description) values
  ('credits_per_story',    '10',    'Credits deducted per story generation'),
  ('free_tier_credits',    '30',    'Credits given to new accounts on signup'),
  ('low_credits_threshold','5',     'Trigger low-credits alert below this balance'),
  ('max_family_members',   '5',     'Max users per account (free plan)'),
  ('sms_enabled',          'true',  'Global kill switch for all SMS sends'),
  ('maintenance_mode',     'false', 'When true, generation endpoints return 503')
on conflict (key) do nothing;

-- ─── Seed: default story templates ───────────────────────────────────────────
insert into story_templates (name, description, system_prompt, user_prompt_template, image_prompt_template, credits_cost) values
(
  'Cozy Adventure',
  'A warm, gentle adventure perfect for winding down at bedtime.',
  'You are a master children''s storyteller. Write warm, imaginative bedtime stories that are calming and age-appropriate. Stories should be 400-600 words, written in a gentle narrative voice. Always end with the child drifting peacefully to sleep. Use simple, vivid language. The child and their toy are the main characters.',
  'Write a cozy bedtime adventure story for {{child_name}}, who is {{child_age}} years old. {{prompt_summary}} The story should feel warm and safe, with a small adventure that resolves happily. End with {{child_name}} falling asleep.',
  'Children''s book illustration, soft watercolor style, warm pastel colors, a young child character matching this description: {{appearance_summary}}, accompanied by their toy: {{toy_summary}}. Cozy bedtime scene, gentle lighting, storybook aesthetic.',
  10
),
(
  'Silly Creatures',
  'A fun, giggly story full of funny characters and silly situations.',
  'You are a children''s storyteller specializing in funny, lighthearted stories. Write silly, playful bedtime stories that will make children giggle before they sleep. Stories should be 400-600 words, with funny situations and lovable characters. Keep it age-appropriate and end gently.',
  'Write a funny bedtime story for {{child_name}}, who is {{child_age}} years old. {{prompt_summary}} Include silly characters and at least one funny situation. Keep the tone playful and light. End with {{child_name}} smiling and falling asleep.',
  'Children''s book illustration, bright and playful cartoon style, fun colors, a young child character matching this description: {{appearance_summary}}, with their toy: {{toy_summary}}. Whimsical and fun scene, expressive characters, joyful storybook style.',
  10
),
(
  'Magical Quest',
  'An epic but calming magical adventure in an enchanted world.',
  'You are a children''s storyteller who specializes in gentle fantasy. Write magical bedtime stories set in enchanted worlds. Stories should be 500-700 words, with rich imagery and wonder. The magic should feel safe and wondrous. End peacefully.',
  'Write a magical bedtime story for {{child_name}}, who is {{child_age}} years old. {{prompt_summary}} Set the story in an enchanted world. Include one magical discovery or power. End with {{child_name}} returning home safely and drifting to sleep.',
  'Children''s book illustration, enchanted fantasy style, soft glowing colors, magical atmosphere, a young child character matching this description: {{appearance_summary}}, with their magical companion toy: {{toy_summary}}. Enchanted forest or magical kingdom setting, dreamlike quality.',
  15
)
on conflict do nothing;

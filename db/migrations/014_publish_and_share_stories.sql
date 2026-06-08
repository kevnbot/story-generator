-- ============================================================
-- 014 — Publish & share stories
-- Apply manually in the Supabase SQL editor (db/migrate.js is intentionally absent).
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- ─── stories: publish/share columns ──────────────────────────────────────────
-- is_published: story is visible to anyone with the share link.
-- share_token:  unguessable token used in the public /share/<token> URL.
-- published_at: timestamp of the first publish.
alter table stories
  add column if not exists is_published boolean not null default false,
  add column if not exists share_token  text unique,
  add column if not exists published_at timestamptz;

-- ─── indexes ─────────────────────────────────────────────────────────────────
-- Serves the public lookup by token (the UNIQUE constraint also creates an index,
-- but the partial index keeps it lean and explicit).
create index if not exists idx_stories_share_token
  on stories(share_token)
  where share_token is not null;

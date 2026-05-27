alter table kid_profiles
  add column if not exists character_illustration_path text,
  add column if not exists character_illustration_url  text,
  add column if not exists toy_reference_image_path    text,
  add column if not exists toy_reference_image_url     text,
  add column if not exists combined_reference_path     text,
  add column if not exists combined_reference_url      text,
  add column if not exists illustration_status         text not null default 'none',
  add column if not exists illustration_error          text,
  add column if not exists illustration_requested_at   timestamptz,
  add column if not exists illustration_completed_at   timestamptz,
  add column if not exists illustration_attempt_count  integer not null default 0;

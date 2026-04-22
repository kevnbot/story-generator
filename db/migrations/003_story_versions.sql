alter table stories
  add column if not exists parent_story_id uuid references stories(id) on delete set null,
  add column if not exists version_number  integer not null default 1,
  add column if not exists has_images      boolean not null default false;

create index if not exists idx_stories_parent_story_id on stories(parent_story_id);

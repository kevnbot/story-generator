alter table kid_profiles
  add column if not exists reference_image_path text;

insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', false)
on conflict (id) do nothing;

-- Allow babies (age = 0)
alter table kid_profiles drop constraint if exists kid_profiles_age_check;
alter table kid_profiles add constraint kid_profiles_age_check check (age between 0 and 17);

-- Months component (0–11) for babies and toddlers
alter table kid_profiles
  add column if not exists age_months integer not null default 0;
alter table kid_profiles drop constraint if exists kid_profiles_age_months_check;
alter table kid_profiles add constraint kid_profiles_age_months_check check (age_months between 0 and 11);

-- Gender for pronoun selection in stories
alter table kid_profiles
  add column if not exists gender text;

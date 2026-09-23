-- 0009 — locations get multiple tags instead of a single category.
--
-- Replaces the single `category text` column with an ordered `tags text[]`. The app caps tags at
-- 5 for free users and 10 for premium (enforced in the add/edit form, same as the photo limit);
-- the CHECK below is the hard ceiling so nobody can exceed the premium cap via direct API calls.
--
-- Apply by hand in the Supabase SQL Editor (there's no migration runner wired up).

alter table public.locations
  add column if not exists tags text[] not null default '{}';

-- Backfill: each existing category becomes that location's first (and only) tag. Skips null/empty.
update public.locations
  set tags = array[category]
  where category is not null and category <> '' and coalesce(array_length(tags, 1), 0) = 0;

alter table public.locations
  add constraint locations_tags_max check (cardinality(tags) <= 10);

alter table public.locations
  drop column if exists category;

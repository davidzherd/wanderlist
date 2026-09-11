-- 0002: currency support for trip budgeting.
--
-- Adds a per-trip default currency and a per-item currency override. The generic `price` column on
-- trip_items already exists (0000/schema.sql); this only adds the currency columns. Apply by hand in
-- the Supabase SQL Editor (there's no migration runner wired up).

alter table public.trips
  add column if not exists currency text not null default 'USD';

-- Nullable: null means "inherit the trip's default currency". Only set when an item's price is in a
-- different currency than the trip default (e.g. a hotel paid in JPY on a USD-home trip).
alter table public.trip_items
  add column if not exists currency text;

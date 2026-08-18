-- Per-pin styling for bucket-list locations: a chosen pin color and an optional emoji shown
-- inside the map marker. Both are nullable — existing rows stay null and the frontend falls
-- back to the legacy brass pin with a plain dot, so nothing changes visually until a user picks.
--
-- Apply by hand in the Supabase SQL Editor (there's no migration runner wired up).

alter table public.locations
  add column if not exists color text,
  add column if not exists emoji text;

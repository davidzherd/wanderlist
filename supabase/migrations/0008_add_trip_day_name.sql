-- 0008: custom day names
--
-- name: an optional label for a trip day. Days are auto-numbered "Day 1",
-- "Day 2", … in the UI by their position (sort_order); this column lets a user
-- override that with a name of their own (e.g. "Arrival", "Beach day"). Nullable
-- and capped at 50 characters — a null/empty name falls back to the auto number,
-- so clearing the field resets a day to its default numbering.
alter table public.trip_days
  add column name text check (name is null or char_length(name) <= 50);

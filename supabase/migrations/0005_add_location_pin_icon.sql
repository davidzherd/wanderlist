-- A line-icon alternative to the emoji pin symbol. Stores a stable icon id (e.g. 'plane',
-- 'mountain') that the frontend resolves back to a Lucide icon; nullable, and mutually exclusive
-- with `emoji` in the UI (a pin shows one symbol). Existing rows stay null and fall back to the
-- dot, so nothing changes until a user picks an icon.
--
-- Apply by hand in the Supabase SQL Editor (there's no migration runner wired up).

alter table public.locations
  add column if not exists icon text;

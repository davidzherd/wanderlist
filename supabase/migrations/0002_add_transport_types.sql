-- Run this in the Supabase SQL Editor to allow the two new transport types (taxi, car)
-- on an already-existing project (schema.sql has this baked in for fresh installs).
-- Postgres auto-names the inline `check` from schema.sql as trip_items_transport_type_check.

alter table public.trip_items
  drop constraint if exists trip_items_transport_type_check;

alter table public.trip_items
  add constraint trip_items_transport_type_check
  check (transport_type in ('plane', 'train', 'bus', 'taxi', 'car'));

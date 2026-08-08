-- Run this in the Supabase SQL Editor to add the transport price column to an
-- already-existing project (schema.sql has this baked in for fresh installs).

alter table public.trip_items
  add column price numeric check (price >= 0);

-- 0003: check-in / check-out DATES for lodging.
--
-- Lodging previously carried only free-text check-in/out TIMES (check_in_time/check_out_time). These
-- dates let a stay span days so the itinerary can auto-render "start/overnight/check-out at [hotel]"
-- banners on every covered day. Times are kept (optional, shown alongside the dates on the banners).
-- Apply by hand in the Supabase SQL Editor.

alter table public.trip_items
  add column if not exists check_in_date date,
  add column if not exists check_out_date date;

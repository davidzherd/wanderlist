-- 0007: per-stop coordinates for travel estimates
--
-- latitude/longitude: custom trip stops (those not backed by a bucket-list
-- location) never persisted the coordinates they were geocoded from, so the
-- itinerary had nothing to estimate travel time/distance between. Linked stops
-- still read coordinates from their bucket-list location; these columns fill the
-- gap for custom stops. Nullable — older rows and non-place items (notes,
-- transport, lodging) simply have no coordinates and get no segment estimate.
--
-- The walk/drive choice per segment is intentionally NOT stored here: it's a
-- lightweight per-viewer UI preference, kept in localStorage (like dark mode)
-- rather than costing a DB write on every toggle.
alter table public.trip_items
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180);

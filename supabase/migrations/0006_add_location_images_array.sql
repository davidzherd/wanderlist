-- 0006 — locations can hold multiple photos.
--
-- Replaces the single `image_url` column with an ordered `image_urls text[]`. The app treats
-- element 0 as the primary image (shown in trips + used for the map popup's portrait/landscape
-- decision) and lets the user scroll the rest in a carousel.
--
-- Apply by hand in the Supabase SQL Editor (there's no migration runner wired up).

alter table public.locations
  add column if not exists image_urls text[] not null default '{}';

-- Backfill: fold each existing single image into a one-element array. Skips null/empty.
update public.locations
  set image_urls = array[image_url]
  where image_url is not null and image_url <> '' and coalesce(array_length(image_urls, 1), 0) = 0;

alter table public.locations
  drop column if exists image_url;

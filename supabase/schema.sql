-- WanderList Supabase schema
--
-- Run this once in the Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Replaces the Xano `Locations` group and the localStorage trips mock. Auth itself needs no table here —
-- Supabase's built-in `auth.users` covers it; `name` is stored in that user's metadata at signup.
--
-- Every table scopes rows to the signed-in user via Row Level Security (RLS), so the frontend never
-- needs to send a user id — Postgres derives it from the request's JWT (auth.uid()), the same trust
-- boundary the old Xano endpoints enforced in XanoScript.

create extension if not exists pgcrypto;

-- ============================================================================
-- profiles — one row per user, holding flags that must NOT be user-editable.
--
-- `name` lives in auth.users' user_metadata because Supabase lets the signed-in user update their
-- own user_metadata client-side (supabase.auth.updateUser) — fine for a display name, but wrong
-- for anything privileged. is_premium/is_admin live here instead, in a table with no insert/update
-- policy for the authenticated role at all, so a user can read their own flags but can never flip
-- them — only changeable via the Supabase SQL editor/dashboard (or a future admin-only backend path).
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_premium boolean not null default false,
  is_admin boolean not null default false
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- Auto-creates a profile row (is_premium/is_admin defaulting to false) whenever a new auth user
-- signs up. security definer means it runs with the function owner's privileges, bypassing RLS —
-- that's what lets it insert here despite no insert policy existing for regular users.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- locations — one row per bucket-list spot, replaces Xano's `location` table
-- ============================================================================

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  country text not null,
  category text not null,
  priority smallint not null check (priority between 1 and 5),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  notes text,
  image_url text,
  visited boolean not null default false,
  created_at timestamptz not null default now()
);

create index locations_user_id_idx on public.locations(user_id);

alter table public.locations enable row level security;

create policy "locations_select_own" on public.locations
  for select using (auth.uid() = user_id);
create policy "locations_insert_own" on public.locations
  for insert with check (auth.uid() = user_id);
create policy "locations_update_own" on public.locations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "locations_delete_own" on public.locations
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- trips — one row per trip. Each trip belongs to exactly one user.
-- ============================================================================

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create index trips_user_id_idx on public.trips(user_id);

alter table public.trips enable row level security;

create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);
create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);
create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trips_delete_own" on public.trips
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- trip_days — ordered days within a trip. sort_order carries the display
-- order since a day may not have a date yet (trip dates are optional).
-- ============================================================================

create table public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date,
  sort_order integer not null default 0
);

create index trip_days_trip_id_idx on public.trip_days(trip_id);

alter table public.trip_days enable row level security;

create policy "trip_days_select_own" on public.trip_days
  for select using (exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid()));
create policy "trip_days_insert_own" on public.trip_days
  for insert with check (exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid()));
create policy "trip_days_update_own" on public.trip_days
  for update using (exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid()));
create policy "trip_days_delete_own" on public.trip_days
  for delete using (exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid()));

-- ============================================================================
-- trip_items — every stop/note/transport/lodging entry on a trip. One table
-- for all four kinds (mirrors the frontend's TripItem union), so a plain
-- fetch-by-trip returns the whole itinerary in one query.
--
-- location_id is a soft link: ON DELETE SET NULL so deleting a bucket-list
-- location never breaks a trip that already used it — name/country/image_url
-- are snapshotted onto the item itself at insert time, not re-read from
-- locations on every fetch.
-- ============================================================================

create table public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_id uuid references public.trip_days(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  kind text not null default 'location' check (kind in ('location', 'note', 'transport', 'lodging')),
  name text not null,
  country text,
  custom boolean not null default false,
  image_url text,
  description text,
  transport_type text check (transport_type in ('plane', 'train', 'bus', 'taxi', 'car')),
  departure_time text,
  arrival_time text,
  price numeric check (price >= 0),
  check_in_time text,
  check_out_time text,
  sort_order integer not null default 0
);

create index trip_items_trip_id_idx on public.trip_items(trip_id);
create index trip_items_day_id_idx on public.trip_items(day_id);

alter table public.trip_items enable row level security;

create policy "trip_items_select_own" on public.trip_items
  for select using (exists (select 1 from public.trips where trips.id = trip_items.trip_id and trips.user_id = auth.uid()));
create policy "trip_items_insert_own" on public.trip_items
  for insert with check (exists (select 1 from public.trips where trips.id = trip_items.trip_id and trips.user_id = auth.uid()));
create policy "trip_items_update_own" on public.trip_items
  for update using (exists (select 1 from public.trips where trips.id = trip_items.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from public.trips where trips.id = trip_items.trip_id and trips.user_id = auth.uid()));
create policy "trip_items_delete_own" on public.trip_items
  for delete using (exists (select 1 from public.trips where trips.id = trip_items.trip_id and trips.user_id = auth.uid()));

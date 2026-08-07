-- Run this in the Supabase SQL Editor to apply the profiles table to an already-existing project
-- (schema.sql has this baked in for fresh installs — this is the same addition, standalone, plus
-- a backfill for accounts that already existed before this migration).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_premium boolean not null default false,
  is_admin boolean not null default false
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

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

-- Backfill: give every already-registered user a profile row too (is_premium/is_admin default false).
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

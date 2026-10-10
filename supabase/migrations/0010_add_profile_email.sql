-- Copy each user's email onto their profiles row, so profiles are easy to match to users in the
-- Table Editor. auth.users stays the source of truth: the email is set on signup and kept in sync
-- by a trigger when it changes. Users still can't write to profiles (no insert/update policy), and
-- RLS only lets them read their own row, so this exposes nothing new.

alter table public.profiles add column email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

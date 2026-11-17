-- Keep the sign-in email on the profile so admins can find users when assigning roles.
alter table public.profiles add column email text;

update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email);
  return new;
end $$;

create index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role) where role <> 'patient';

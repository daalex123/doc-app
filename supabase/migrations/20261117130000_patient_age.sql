-- Keep each patient's current age stored in the database.
-- age_years / age_text are DERIVED from dob (Asia/Colombo "today"):
--  * a BEFORE INSERT/UPDATE trigger always recomputes them (they can't be forged via the API),
--  * a daily pg_cron job refreshes everyone shortly after midnight Colombo time.

create or replace function private.age_text(dob date)
returns text
language sql
stable
set search_path = ''
as $$
  with t as (
    select (now() at time zone 'Asia/Colombo')::date as today
  ), m as (
    select
      t.today,
      ((extract(year from t.today)::int - extract(year from dob)::int) * 12
        + (extract(month from t.today)::int - extract(month from dob)::int)
        - case when extract(day from t.today) < extract(day from dob) then 1 else 0 end) as months
    from t
  )
  select case
    when months < 0 then '0 days'
    when months < 1 then (today - dob)::text || case when (today - dob) = 1 then ' day' else ' days' end
    when months < 24 then months::text || case when months = 1 then ' month' else ' months' end
    when months / 12 < 18 and months % 12 > 0
      then (months / 12)::text || ' yrs ' || (months % 12)::text || case when months % 12 = 1 then ' mo' else ' mos' end
    else (months / 12)::text || ' yrs'
  end
  from m;
$$;

create or replace function private.age_years(dob date)
returns int
language sql
stable
set search_path = ''
as $$
  select greatest(0, extract(year from age((now() at time zone 'Asia/Colombo')::date, dob))::int);
$$;

alter table public.patients
  add column age_years integer,
  add column age_text text;

create or replace function private.patients_set_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.age_years := private.age_years(new.dob);
  new.age_text := private.age_text(new.dob);
  return new;
end;
$$;

-- "zz" so it fires after patients_touch
create trigger patients_zz_age
  before insert or update on public.patients
  for each row execute function private.patients_set_age();

-- Skip the updated_at bump while the nightly job refreshes ages.
create or replace function private.patients_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.age_refresh', true), '') <> 'on' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger patients_touch on public.patients;
create trigger patients_touch
  before update on public.patients
  for each row execute function private.patients_touch();

create or replace function private.refresh_patient_ages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform set_config('app.age_refresh', 'on', true);
  update public.patients p
     set dob = p.dob
   where p.age_text is distinct from private.age_text(p.dob)
      or p.age_years is distinct from private.age_years(p.dob);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function private.refresh_patient_ages() from public, anon, authenticated;
revoke all on function private.age_text(date), private.age_years(date) from public, anon, authenticated;

-- backfill existing rows
select private.refresh_patient_ages();

-- nightly refresh at 00:01 Asia/Colombo (= 18:31 UTC)
create extension if not exists pg_cron;
select cron.schedule('refresh-patient-ages', '31 18 * * *', 'select private.refresh_patient_ages()');

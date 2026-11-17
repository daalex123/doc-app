-- Clinic appointment app: initial schema
-- Timezone for all slot logic: Asia/Colombo (no DST)


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('patient', 'receptionist', 'doctor', 'admin');
create type public.appointment_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');

-- ---------------------------------------------------------------------------
-- Private schema (not exposed through the Data API) for RLS helpers
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles (one per auth user, holds the role)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'patient',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- role helpers (SECURITY DEFINER lives in the private schema, never exposed)
create or replace function private.user_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.profiles where id = (select auth.uid()))
                  in ('admin', 'doctor', 'receptionist'), false)
$$;

create or replace function private.is_clinical()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.profiles where id = (select auth.uid()))
                  in ('admin', 'doctor'), false)
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.profiles where id = (select auth.uid())) = 'admin', false)
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.user_role(), private.is_staff(),
  private.is_clinical(), private.is_admin() to authenticated;

-- create a profile automatically for every new auth user
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- clinic_settings (single row)
-- ---------------------------------------------------------------------------
create table public.clinic_settings (
  id boolean primary key default true check (id),
  name text not null default 'My Clinic',
  whatsapp text not null default '+94777724098',
  cancel_window_hours int not null default 4 check (cancel_window_hours >= 0),
  max_advance_days int not null default 60 check (max_advance_days > 0),
  updated_at timestamptz not null default now()
);
insert into public.clinic_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.profiles (id) on delete set null,
  is_self boolean not null default false,
  full_name text not null check (full_name ~ '^\S+ \S+$'),
  gender text not null check (gender in ('female', 'male', 'other')),
  dob date not null check (dob <= current_date),
  phone text not null check (phone ~ '^\+94[0-9]{9}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+94[0-9]{9}$'),
  food_allergies text,
  drug_allergies text,
  no_known_allergies boolean not null default false,
  nic text,
  address text,
  city text,
  blood_group text check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  emergency_contact_name text,
  emergency_contact_phone text,
  guardian_name text,
  guardian_phone text,
  consent_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patients_account_idx on public.patients (account_id);
create index patients_phone_idx on public.patients (phone);
create index patients_name_idx on public.patients (lower(full_name));
create unique index patients_one_self_per_account on public.patients (account_id) where is_self;
create trigger patients_touch before update on public.patients
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- doctors, schedules, exceptions
-- ---------------------------------------------------------------------------
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  specialty text not null,
  bio text,
  fee numeric(10, 2) not null default 0 check (fee >= 0),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger doctors_touch before update on public.doctors
  for each row execute function private.touch_updated_at();

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  slot_minutes int not null default 15 check (slot_minutes between 5 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index schedules_doctor_idx on public.schedules (doctor_id, weekday);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (doctor_id, date)
);

-- ---------------------------------------------------------------------------
-- appointments and payments
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  doctor_id uuid not null references public.doctors (id) on delete restrict,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slot_end > slot_start)
);
create index appointments_patient_idx on public.appointments (patient_id, slot_start desc);
create index appointments_doctor_idx on public.appointments (doctor_id, slot_start);
create index appointments_slot_idx on public.appointments (slot_start);
-- the double-booking guard: one live appointment per doctor per slot
create unique index appointments_no_double_booking
  on public.appointments (doctor_id, slot_start) where status <> 'cancelled';
create trigger appointments_touch before update on public.appointments
  for each row execute function private.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  method text not null default 'cash' check (method in ('cash', 'bank_transfer', 'card', 'online')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- medical history and visit records
-- ---------------------------------------------------------------------------
create table public.history_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  category text not null check (category in
    ('allergy', 'condition', 'medication', 'surgery', 'past_illness',
     'family', 'lifestyle', 'immunization', 'device', 'other')),
  title text not null,
  detail text,
  year int check (year is null or year between 1900 and 2200),
  status text not null default 'active' check (status in ('active', 'resolved')),
  reviewed_on date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index history_entries_patient_idx on public.history_entries (patient_id, category);
create trigger history_entries_touch before update on public.history_entries
  for each row execute function private.touch_updated_at();

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid unique references public.appointments (id) on delete set null,
  doctor_id uuid references public.doctors (id) on delete set null,
  visit_date timestamptz not null default now(),
  complaint text,
  symptoms text,
  vitals jsonb not null default '{}'::jsonb,
  diagnosis text,
  examination text,
  treatment text,
  advice text,
  follow_up_date date,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_patient_idx on public.visits (patient_id, visit_date desc);
create index visits_follow_up_idx on public.visits (follow_up_date) where follow_up_date is not null;
create trigger visits_touch before update on public.visits
  for each row execute function private.touch_updated_at();

-- private doctor notes live in their own table so patients can never read them
create table public.visit_private_notes (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  note text not null
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  medicine text not null,
  dose text,
  frequency text,
  duration text,
  notes text,
  created_at timestamptz not null default now()
);
create index prescription_items_visit_idx on public.prescription_items (visit_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  title text not null,
  file_path text not null,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index documents_patient_idx on public.documents (patient_id, created_at desc);
create index documents_visit_idx on public.documents (visit_id);

-- a finalized visit is never silently overwritten: the old version is kept
create table public.visit_amendments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  edited_by uuid references public.profiles (id) on delete set null,
  previous jsonb not null,
  created_at timestamptz not null default now()
);
create index visit_amendments_visit_idx on public.visit_amendments (visit_id, created_at desc);

create or replace function private.keep_visit_amendment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'finalized' then
    insert into public.visit_amendments (visit_id, edited_by, previous)
    values (old.id, (select auth.uid()), to_jsonb(old));
  end if;
  return new;
end $$;
create trigger visits_amendment before update on public.visits
  for each row execute function private.keep_visit_amendment();

-- ---------------------------------------------------------------------------
-- audit log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  patient_id uuid,
  created_at timestamptz not null default now()
);
create index audit_log_patient_idx on public.audit_log (patient_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.history_entries enable row level security;
alter table public.visits enable row level security;
alter table public.visit_private_notes enable row level security;
alter table public.prescription_items enable row level security;
alter table public.documents enable row level security;
alter table public.visit_amendments enable row level security;
alter table public.audit_log enable row level security;

-- profiles: read own or staff; users may only change their own name (role is column-protected)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- clinic settings
create policy settings_select on public.clinic_settings for select to anon, authenticated using (true);
create policy settings_update on public.clinic_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- patients
create policy patients_select on public.patients for select to authenticated
  using (account_id = (select auth.uid()) or (select private.is_staff()));
create policy patients_insert on public.patients for insert to authenticated
  with check (account_id = (select auth.uid()) or (select private.is_staff()));
create policy patients_update on public.patients for update to authenticated
  using (account_id = (select auth.uid()) or (select private.is_staff()))
  with check (account_id = (select auth.uid()) or (select private.is_staff()));

-- doctors
create policy doctors_select_public on public.doctors for select to anon using (active);
create policy doctors_select_auth on public.doctors for select to authenticated
  using (active or (select private.is_staff()));
create policy doctors_admin_write on public.doctors for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- schedules and exceptions
create policy schedules_select on public.schedules for select to authenticated using (true);
create policy schedules_admin_write on public.schedules for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy exceptions_select on public.schedule_exceptions for select to authenticated using (true);
create policy exceptions_admin_write on public.schedule_exceptions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- appointments: owners read; staff read and manage; patients book/cancel through functions only
create policy appointments_select on public.appointments for select to authenticated
  using ((select private.is_staff())
         or patient_id in (select id from public.patients where account_id = (select auth.uid())));
create policy appointments_staff_insert on public.appointments for insert to authenticated
  with check ((select private.is_staff()));
create policy appointments_staff_update on public.appointments for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- payments
create policy payments_select on public.payments for select to authenticated
  using ((select private.is_staff())
         or appointment_id in (
           select a.id from public.appointments a
           join public.patients p on p.id = a.patient_id
           where p.account_id = (select auth.uid())));
create policy payments_staff_write on public.payments for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- clinical tables: read for owner + doctor/admin, write for doctor/admin
create policy history_select on public.history_entries for select to authenticated
  using ((select private.is_clinical())
         or patient_id in (select id from public.patients where account_id = (select auth.uid())));
create policy history_insert on public.history_entries for insert to authenticated
  with check ((select private.is_clinical())
              or patient_id in (select id from public.patients where account_id = (select auth.uid())));
create policy history_update on public.history_entries for update to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));
create policy history_delete on public.history_entries for delete to authenticated
  using ((select private.is_clinical()));

create policy visits_select on public.visits for select to authenticated
  using ((select private.is_clinical())
         or patient_id in (select id from public.patients where account_id = (select auth.uid())));
create policy visits_clinical_insert on public.visits for insert to authenticated
  with check ((select private.is_clinical()));
create policy visits_clinical_update on public.visits for update to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));

create policy private_notes_clinical on public.visit_private_notes for all to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));

create policy rx_select on public.prescription_items for select to authenticated
  using ((select private.is_clinical())
         or visit_id in (
           select v.id from public.visits v
           join public.patients p on p.id = v.patient_id
           where p.account_id = (select auth.uid())));
create policy rx_clinical_write on public.prescription_items for all to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));

create policy documents_select on public.documents for select to authenticated
  using ((select private.is_clinical())
         or patient_id in (select id from public.patients where account_id = (select auth.uid())));
create policy documents_clinical_write on public.documents for all to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));

create policy amendments_clinical on public.visit_amendments for all to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));

create policy audit_insert on public.audit_log for insert to authenticated
  with check (actor_id = (select auth.uid()));
create policy audit_admin_select on public.audit_log for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Table privileges (Data API). RLS above decides which rows.
-- ---------------------------------------------------------------------------
grant select on public.doctors, public.clinic_settings to anon;

grant select, insert, update, delete on
  public.patients, public.doctors, public.schedules, public.schedule_exceptions,
  public.appointments, public.payments, public.history_entries, public.visits,
  public.visit_private_notes, public.prescription_items, public.documents,
  public.visit_amendments to authenticated;
grant select, update on public.clinic_settings to authenticated;
grant select, insert on public.audit_log to authenticated;

-- profiles: the role column can never be changed by the client
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Slot logic (single source of truth, used by both the UI and booking)
-- ---------------------------------------------------------------------------
create or replace function public.available_slots(p_doctor uuid, p_date date)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.st, g.en
  from (
    select
      ((p_date + sc.start_time) at time zone 'Asia/Colombo') + make_interval(mins => n * sc.slot_minutes) as st,
      ((p_date + sc.start_time) at time zone 'Asia/Colombo') + make_interval(mins => (n + 1) * sc.slot_minutes) as en
    from public.schedules sc,
    lateral generate_series(
      0, (extract(epoch from (sc.end_time - sc.start_time)) / 60)::int / sc.slot_minutes - 1
    ) n
    where (select auth.uid()) is not null
      and sc.doctor_id = p_doctor
      and sc.active
      and sc.weekday = extract(dow from p_date)::int
  ) g
  where g.st > now()
    and not exists (
      select 1 from public.schedule_exceptions e
      where e.doctor_id = p_doctor and e.date = p_date)
    and not exists (
      select 1 from public.appointments a
      where a.doctor_id = p_doctor and a.slot_start = g.st and a.status <> 'cancelled')
  order by g.st
$$;

create or replace function public.book_appointment(
  p_patient uuid, p_doctor uuid, p_slot timestamptz, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_staff boolean := (select private.is_staff());
  v_slot record;
  v_id uuid;
  v_max int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not v_staff and not exists (
    select 1 from public.patients where id = p_patient and account_id = v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.doctors where id = p_doctor and active) then
    raise exception 'doctor_unavailable';
  end if;

  select max_advance_days into v_max from public.clinic_settings where id;
  if not v_staff and p_slot > now() + make_interval(days => v_max) then
    raise exception 'too_far_ahead';
  end if;

  select s.slot_start, s.slot_end into v_slot
  from public.available_slots(p_doctor, (p_slot at time zone 'Asia/Colombo')::date) s
  where s.slot_start = p_slot;

  if not found then
    raise exception 'slot_taken';
  end if;

  begin
    insert into public.appointments (patient_id, doctor_id, slot_start, slot_end, reason, created_by)
    values (p_patient, p_doctor, v_slot.slot_start, v_slot.slot_end, nullif(trim(p_reason), ''), v_uid)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'slot_taken';
  end;

  return v_id;
end $$;

create or replace function public.cancel_appointment(p_appointment uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_staff boolean := (select private.is_staff());
  v_appt public.appointments;
  v_window int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_appt from public.appointments where id = p_appointment;
  if not found then
    raise exception 'not_found';
  end if;

  if not v_staff then
    if not exists (select 1 from public.patients where id = v_appt.patient_id and account_id = v_uid) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select cancel_window_hours into v_window from public.clinic_settings where id;
    if v_appt.slot_start < now() + make_interval(hours => v_window) then
      raise exception 'too_late_to_cancel';
    end if;
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'not_cancellable';
  end if;

  update public.appointments set status = 'cancelled', cancelled_at = now() where id = p_appointment;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

revoke execute on function public.available_slots(uuid, date),
  public.book_appointment(uuid, uuid, timestamptz, text),
  public.cancel_appointment(uuid),
  public.admin_set_role(uuid, public.app_role) from public, anon;
grant execute on function public.available_slots(uuid, date),
  public.book_appointment(uuid, uuid, timestamptz, text),
  public.cancel_appointment(uuid),
  public.admin_set_role(uuid, public.app_role) to authenticated;

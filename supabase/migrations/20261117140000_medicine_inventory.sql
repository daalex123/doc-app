-- Medicine catalog, stock ledger, prescription templates.

-- ---------------------------------------------------------------------------
-- medicines (catalog)
-- ---------------------------------------------------------------------------
create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  generic_name text,
  strength text not null default '',
  form text not null default 'tablet'
    check (form in ('tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'other')),
  unit text not null default 'unit',
  default_dose text,
  default_frequency text,
  default_duration text,
  unit_price numeric(10, 2) not null default 0 check (unit_price >= 0),
  reorder_level int not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index medicines_identity_key
  on public.medicines (lower(name || '|' || strength || '|' || form));
create index medicines_name_idx on public.medicines (lower(name));
create trigger medicines_touch before update on public.medicines
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- stock_movements (append-only ledger; written only through the RPC)
-- ---------------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  kind text not null check (kind in ('receive', 'dispense', 'adjust', 'expired')),
  quantity int not null check (quantity <> 0),
  batch_no text,
  expiry_date date,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'receive' and quantity > 0)
      or (kind in ('dispense', 'expired') and quantity < 0)
      or kind = 'adjust')
);
create index stock_movements_medicine_idx on public.stock_movements (medicine_id, created_at desc);
create index stock_movements_created_by_idx on public.stock_movements (created_by);
create index stock_movements_expiry_idx on public.stock_movements (expiry_date) where expiry_date is not null;

-- Current stock per medicine. next_expiry is the earliest expiry among received batches
-- that still have stock (batches without a batch number count while any stock remains).
create view public.medicine_stock with (security_invoker = true) as
select
  m.*,
  coalesce((select sum(s.quantity) from public.stock_movements s where s.medicine_id = m.id), 0)::int as stock,
  (select min(r.expiry_date)
     from public.stock_movements r
    where r.medicine_id = m.id and r.kind = 'receive' and r.expiry_date is not null
      and (r.batch_no is null
           or (select sum(b.quantity) from public.stock_movements b
                where b.medicine_id = m.id and b.batch_no = r.batch_no) > 0)
  ) as next_expiry
from public.medicines m;

-- Single entry point for stock changes. Quantity is a positive magnitude for
-- receive/dispense/expired and a signed non-zero number for adjust.
create or replace function public.record_stock_movement(
  p_medicine uuid,
  p_kind text,
  p_quantity int,
  p_batch_no text default null,
  p_expiry date default null,
  p_note text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_signed int;
  v_current int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('receive', 'dispense', 'adjust', 'expired') then
    raise exception 'invalid_kind';
  end if;
  -- dispensing is a clinical action; every other movement is admin-only
  if p_kind = 'dispense' then
    if not (select private.is_clinical()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif not (select private.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity = 0 or (p_kind <> 'adjust' and p_quantity < 0) then
    raise exception 'invalid_quantity';
  end if;
  if p_kind = 'adjust' and nullif(trim(p_note), '') is null then
    raise exception 'reason_required';
  end if;

  v_signed := case when p_kind in ('dispense', 'expired') then -p_quantity else p_quantity end;

  -- serialise concurrent movements for this medicine
  perform 1 from public.medicines where id = p_medicine for update;
  if not found then
    raise exception 'not_found';
  end if;

  select coalesce(sum(quantity), 0) into v_current
    from public.stock_movements where medicine_id = p_medicine;
  if v_current + v_signed < 0 then
    raise exception 'insufficient_stock';
  end if;

  insert into public.stock_movements (medicine_id, kind, quantity, batch_no, expiry_date, note, created_by)
  values (p_medicine, p_kind, v_signed,
          nullif(trim(p_batch_no), ''),
          case when p_kind = 'receive' then p_expiry end,
          nullif(trim(p_note), ''),
          v_uid);

  return v_current + v_signed;
end $$;

revoke execute on function public.record_stock_movement(uuid, text, int, text, date, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, int, text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- prescription templates (shared with all clinicians)
-- ---------------------------------------------------------------------------
create table public.prescription_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prescription_templates_created_by_idx on public.prescription_templates (created_by);
create trigger prescription_templates_touch before update on public.prescription_templates
  for each row execute function private.touch_updated_at();

create table public.prescription_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.prescription_templates (id) on delete cascade,
  position int not null default 0,
  medicine text not null check (length(trim(medicine)) > 0),
  dose text,
  frequency text,
  duration text,
  notes text
);
create index prescription_template_items_template_idx
  on public.prescription_template_items (template_id, position);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.medicines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.prescription_templates enable row level security;
alter table public.prescription_template_items enable row level security;

create policy medicines_staff_select on public.medicines for select to authenticated
  using ((select private.is_staff()));
create policy medicines_clinical_insert on public.medicines for insert to authenticated
  with check ((select private.is_clinical()));
create policy medicines_clinical_update on public.medicines for update to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));

create policy stock_staff_select on public.stock_movements for select to authenticated
  using ((select private.is_staff()));

create policy templates_clinical_select on public.prescription_templates for select to authenticated
  using ((select private.is_clinical()));
create policy templates_clinical_insert on public.prescription_templates for insert to authenticated
  with check ((select private.is_clinical()) and created_by = (select auth.uid()));
create policy templates_owner_update on public.prescription_templates for update to authenticated
  using ((select private.is_admin()) or created_by = (select auth.uid()))
  with check ((select private.is_admin()) or created_by = (select auth.uid()));
create policy templates_owner_delete on public.prescription_templates for delete to authenticated
  using ((select private.is_admin()) or created_by = (select auth.uid()));

create policy template_items_clinical_select on public.prescription_template_items for select to authenticated
  using ((select private.is_clinical()));
create policy template_items_owner_write on public.prescription_template_items for all to authenticated
  using (exists (select 1 from public.prescription_templates t
                  where t.id = template_id
                    and ((select private.is_admin()) or t.created_by = (select auth.uid()))))
  with check (exists (select 1 from public.prescription_templates t
                       where t.id = template_id
                         and ((select private.is_admin()) or t.created_by = (select auth.uid()))));

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on public.medicines, public.stock_movements, public.medicine_stock,
  public.prescription_templates, public.prescription_template_items from anon, public;
grant select, insert, update on public.medicines to authenticated;
grant select on public.stock_movements, public.medicine_stock to authenticated;
grant select, insert, update, delete on
  public.prescription_templates, public.prescription_template_items to authenticated;

-- ---------------------------------------------------------------------------
-- Sample catalog (no stock). Safe to re-run.
-- ---------------------------------------------------------------------------
insert into public.medicines
  (name, generic_name, strength, form, unit, default_dose, default_frequency, default_duration, unit_price, reorder_level)
values
  ('Paracetamol', 'Paracetamol', '500mg', 'tablet', 'tablet', '1 tab', 'TDS', '3 days', 3.00, 200),
  ('Ibuprofen', 'Ibuprofen', '400mg', 'tablet', 'tablet', '1 tab', 'TDS', '3 days', 8.00, 100),
  ('Diclofenac', 'Diclofenac sodium', '50mg', 'tablet', 'tablet', '1 tab', 'BD', '5 days', 6.00, 100),
  ('Amoxicillin', 'Amoxicillin', '500mg', 'capsule', 'capsule', '1 cap', 'TDS', '5 days', 25.00, 100),
  ('Amoxicillin-Clavulanate', 'Amoxicillin + clavulanic acid', '625mg', 'tablet', 'tablet', '1 tab', 'BD', '5 days', 85.00, 60),
  ('Azithromycin', 'Azithromycin', '500mg', 'tablet', 'tablet', '1 tab', 'OD', '3 days', 150.00, 30),
  ('Cefuroxime', 'Cefuroxime axetil', '500mg', 'tablet', 'tablet', '1 tab', 'BD', '5 days', 120.00, 30),
  ('Ciprofloxacin', 'Ciprofloxacin', '500mg', 'tablet', 'tablet', '1 tab', 'BD', '5 days', 25.00, 40),
  ('Metronidazole', 'Metronidazole', '400mg', 'tablet', 'tablet', '1 tab', 'TDS', '5 days', 6.00, 60),
  ('Doxycycline', 'Doxycycline', '100mg', 'capsule', 'capsule', '1 cap', 'BD', '7 days', 15.00, 40),
  ('Cetirizine', 'Cetirizine hydrochloride', '10mg', 'tablet', 'tablet', '1 tab', 'nocte', '5 days', 3.00, 150),
  ('Chlorpheniramine', 'Chlorpheniramine maleate', '4mg', 'tablet', 'tablet', '1 tab', 'TDS', '3 days', 1.50, 100),
  ('Loratadine', 'Loratadine', '10mg', 'tablet', 'tablet', '1 tab', 'OD', '5 days', 12.00, 60),
  ('Omeprazole', 'Omeprazole', '20mg', 'capsule', 'capsule', '1 cap', 'mane', '2 weeks', 10.00, 100),
  ('Domperidone', 'Domperidone', '10mg', 'tablet', 'tablet', '1 tab', 'TDS', '3 days', 7.00, 60),
  ('Antacid suspension', 'Aluminium hydroxide + magnesium hydroxide', '', 'syrup', 'bottle', '10 ml', 'TDS', '5 days', 350.00, 10),
  ('Salbutamol', 'Salbutamol sulphate', '2mg', 'tablet', 'tablet', '1 tab', 'TDS', '5 days', 2.00, 100),
  ('Salbutamol inhaler', 'Salbutamol sulphate', '100mcg', 'other', 'inhaler', '2 puffs', 'PRN', 'ongoing', 650.00, 5),
  ('Prednisolone', 'Prednisolone', '5mg', 'tablet', 'tablet', '1 tab', 'BD', '5 days', 3.00, 100),
  ('Bromhexine', 'Bromhexine hydrochloride', '8mg/5ml', 'syrup', 'bottle', '5 ml', 'TDS', '5 days', 280.00, 10),
  ('ORS', 'Oral rehydration salts', '', 'other', 'sachet', '1 sachet', 'PRN', '3 days', 30.00, 100),
  ('Loperamide', 'Loperamide hydrochloride', '2mg', 'capsule', 'capsule', '1 cap', 'PRN', '2 days', 12.00, 40),
  ('Hyoscine butylbromide', 'Hyoscine butylbromide', '10mg', 'tablet', 'tablet', '1 tab', 'TDS', '3 days', 10.00, 60),
  ('Metformin', 'Metformin hydrochloride', '500mg', 'tablet', 'tablet', '1 tab', 'BD', 'ongoing', 4.00, 200),
  ('Amlodipine', 'Amlodipine besilate', '5mg', 'tablet', 'tablet', '1 tab', 'OD', 'ongoing', 5.00, 200),
  ('Losartan', 'Losartan potassium', '50mg', 'tablet', 'tablet', '1 tab', 'OD', 'ongoing', 9.00, 150),
  ('Ferrous sulphate + folic acid', 'Ferrous sulphate + folic acid', '200mg/0.4mg', 'tablet', 'tablet', '1 tab', 'OD', '1 month', 4.00, 150),
  ('Multivitamin', 'Multivitamin', '', 'tablet', 'tablet', '1 tab', 'OD', '1 month', 8.00, 100),
  ('Clotrimazole cream', 'Clotrimazole', '1%', 'cream', 'tube', 'apply thinly', 'BD', '2 weeks', 220.00, 10),
  ('Chloramphenicol eye drops', 'Chloramphenicol', '0.5%', 'drops', 'bottle', '1 drop', 'QDS', '5 days', 180.00, 10)
on conflict do nothing;

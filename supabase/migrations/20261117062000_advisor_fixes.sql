-- Advisor fixes: split FOR ALL policies (avoid multiple permissive SELECT policies),
-- index remaining foreign keys, lock down platform helper.

-- doctors
drop policy doctors_admin_write on public.doctors;
create policy doctors_admin_insert on public.doctors for insert to authenticated
  with check ((select private.is_admin()));
create policy doctors_admin_update on public.doctors for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy doctors_admin_delete on public.doctors for delete to authenticated
  using ((select private.is_admin()));

-- schedules
drop policy schedules_admin_write on public.schedules;
create policy schedules_admin_insert on public.schedules for insert to authenticated
  with check ((select private.is_admin()));
create policy schedules_admin_update on public.schedules for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy schedules_admin_delete on public.schedules for delete to authenticated
  using ((select private.is_admin()));

-- schedule exceptions
drop policy exceptions_admin_write on public.schedule_exceptions;
create policy exceptions_admin_insert on public.schedule_exceptions for insert to authenticated
  with check ((select private.is_admin()));
create policy exceptions_admin_update on public.schedule_exceptions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy exceptions_admin_delete on public.schedule_exceptions for delete to authenticated
  using ((select private.is_admin()));

-- payments
drop policy payments_staff_write on public.payments;
create policy payments_staff_insert on public.payments for insert to authenticated
  with check ((select private.is_staff()));
create policy payments_staff_update on public.payments for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy payments_staff_delete on public.payments for delete to authenticated
  using ((select private.is_staff()));

-- prescription items
drop policy rx_clinical_write on public.prescription_items;
create policy rx_clinical_insert on public.prescription_items for insert to authenticated
  with check ((select private.is_clinical()));
create policy rx_clinical_update on public.prescription_items for update to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));
create policy rx_clinical_delete on public.prescription_items for delete to authenticated
  using ((select private.is_clinical()));

-- documents
drop policy documents_clinical_write on public.documents;
create policy documents_clinical_insert on public.documents for insert to authenticated
  with check ((select private.is_clinical()));
create policy documents_clinical_update on public.documents for update to authenticated
  using ((select private.is_clinical())) with check ((select private.is_clinical()));
create policy documents_clinical_delete on public.documents for delete to authenticated
  using ((select private.is_clinical()));

-- remaining foreign key indexes
create index appointments_created_by_idx on public.appointments (created_by);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create index history_entries_created_by_idx on public.history_entries (created_by);
create index visit_amendments_edited_by_idx on public.visit_amendments (edited_by);
create index visits_created_by_idx on public.visits (created_by);

-- platform helper should not be callable through the API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Patients only see finalized visits (and their prescriptions). Drafts are staff-only.
drop policy visits_select on public.visits;
create policy visits_select on public.visits for select to authenticated
  using ((select private.is_clinical())
         or (status = 'finalized'
             and patient_id in (select id from public.patients where account_id = (select auth.uid()))));

drop policy rx_select on public.prescription_items;
create policy rx_select on public.prescription_items for select to authenticated
  using ((select private.is_clinical())
         or visit_id in (
           select v.id from public.visits v
           join public.patients p on p.id = v.patient_id
           where v.status = 'finalized' and p.account_id = (select auth.uid())));

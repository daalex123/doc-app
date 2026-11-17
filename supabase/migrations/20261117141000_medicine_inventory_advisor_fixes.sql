-- Avoid overlapping permissive SELECT policies on template items; drop redundant index.
drop policy template_items_owner_write on public.prescription_template_items;

create policy template_items_owner_insert on public.prescription_template_items for insert to authenticated
  with check (exists (select 1 from public.prescription_templates t
                       where t.id = template_id
                         and ((select private.is_admin()) or t.created_by = (select auth.uid()))));
create policy template_items_owner_update on public.prescription_template_items for update to authenticated
  using (exists (select 1 from public.prescription_templates t
                  where t.id = template_id
                    and ((select private.is_admin()) or t.created_by = (select auth.uid()))))
  with check (exists (select 1 from public.prescription_templates t
                       where t.id = template_id
                         and ((select private.is_admin()) or t.created_by = (select auth.uid()))));
create policy template_items_owner_delete on public.prescription_template_items for delete to authenticated
  using (exists (select 1 from public.prescription_templates t
                  where t.id = template_id
                    and ((select private.is_admin()) or t.created_by = (select auth.uid()))));

drop index public.medicines_name_idx;

-- Patient avatars: private bucket, RLS mirroring public.patients access, avatar_path column.
alter table public.patients add column avatar_path text;
alter table public.patients add constraint patients_avatar_path_owner
  check (avatar_path is null or avatar_path like id::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-avatars', 'patient-avatars', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- First path segment is the patient id. Owners (via their account) and staff only.
create policy patient_avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'patient-avatars' and (
    (select private.is_staff())
    or (storage.foldername(name))[1] in
       (select id::text from public.patients where account_id = (select auth.uid()))));
create policy patient_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-avatars' and (
    (select private.is_staff())
    or (storage.foldername(name))[1] in
       (select id::text from public.patients where account_id = (select auth.uid()))));
create policy patient_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'patient-avatars' and (
    (select private.is_staff())
    or (storage.foldername(name))[1] in
       (select id::text from public.patients where account_id = (select auth.uid()))))
  with check (bucket_id = 'patient-avatars' and (
    (select private.is_staff())
    or (storage.foldername(name))[1] in
       (select id::text from public.patients where account_id = (select auth.uid()))));
create policy patient_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'patient-avatars' and (
    (select private.is_staff())
    or (storage.foldername(name))[1] in
       (select id::text from public.patients where account_id = (select auth.uid()))));

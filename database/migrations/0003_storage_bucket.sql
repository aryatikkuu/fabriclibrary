-- ===========================================================================
-- Storage bucket for fabric images and documents.
-- Paths follow: mills/{mill-slug}/fabrics/{FABRIC_CODE}/(images|documents)/...
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('textile-library', 'textile-library', true)
on conflict (id) do nothing;

create policy "library: public read" on storage.objects for select
  using (bucket_id = 'textile-library');

create policy "library: staff upload" on storage.objects for insert
  with check (
    bucket_id = 'textile-library'
    and public.current_role() in ('admin', 'editor')
  );

create policy "library: staff update" on storage.objects for update
  using (
    bucket_id = 'textile-library'
    and public.current_role() in ('admin', 'editor')
  );

create policy "library: admin delete" on storage.objects for delete
  using (
    bucket_id = 'textile-library'
    and public.current_role() = 'admin'
  );

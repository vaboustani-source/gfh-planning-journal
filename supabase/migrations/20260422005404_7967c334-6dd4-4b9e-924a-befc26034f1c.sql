insert into storage.buckets (id, name, public)
values ('event-documents', 'event-documents', true)
on conflict (id) do nothing;

create policy "Public read event-documents"
  on storage.objects for select
  using (bucket_id = 'event-documents');

create policy "Admins upload event-documents"
  on storage.objects for insert
  with check (bucket_id = 'event-documents' and is_admin(auth.uid()));

create policy "Admins update event-documents"
  on storage.objects for update
  using (bucket_id = 'event-documents' and is_admin(auth.uid()));

create policy "Admins delete event-documents"
  on storage.objects for delete
  using (bucket_id = 'event-documents' and is_admin(auth.uid()));
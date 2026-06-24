-- project_emails
drop policy if exists "Admins manage project emails" on public.project_emails;
create policy "Staff manage project emails" on public.project_emails
  for all
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')));

-- filed_threads
drop policy if exists "Admins manage filed threads" on public.filed_threads;
create policy "Staff manage filed threads" on public.filed_threads
  for all
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')));

-- email_sender_map
drop policy if exists "Admins manage sender map" on public.email_sender_map;
create policy "Staff manage sender map" on public.email_sender_map
  for all
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')));

-- gmail_connections
drop policy if exists "Admins manage gmail connections" on public.gmail_connections;
create policy "Staff manage gmail connections" on public.gmail_connections
  for all
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','event_director','planner')));
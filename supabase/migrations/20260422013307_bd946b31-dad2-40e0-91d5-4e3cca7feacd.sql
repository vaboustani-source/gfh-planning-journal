create table public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  fields jsonb not null default '[]',
  is_template boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table public.form_assignments (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.forms(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  status text default 'not_started',
  submitted_at timestamptz,
  created_at timestamptz default now(),
  unique(form_id, event_id)
);

create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.form_assignments(id) on delete cascade unique,
  responses jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table public.forms enable row level security;
alter table public.form_assignments enable row level security;
alter table public.form_responses enable row level security;

create policy "Admins manage forms" on public.forms for all
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Event members read forms they're assigned" on public.forms for select
  using (exists (
    select 1 from public.form_assignments fa
    join public.event_users eu on eu.event_id = fa.event_id
    where fa.form_id = forms.id and eu.user_id = auth.uid()
  ));

create policy "Admins manage form assignments" on public.form_assignments for all
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Event members read their assignments" on public.form_assignments for select
  using (exists (select 1 from public.event_users where event_id = form_assignments.event_id and user_id = auth.uid()));

create policy "Event members update their assignment status" on public.form_assignments for update
  using (exists (select 1 from public.event_users where event_id = form_assignments.event_id and user_id = auth.uid()))
  with check (exists (select 1 from public.event_users where event_id = form_assignments.event_id and user_id = auth.uid()));

create policy "Admins read all responses" on public.form_responses for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Event members manage their responses" on public.form_responses for all
  using (exists (
    select 1 from public.form_assignments fa
    join public.event_users eu on eu.event_id = fa.event_id
    where fa.id = form_responses.assignment_id and eu.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.form_assignments fa
    join public.event_users eu on eu.event_id = fa.event_id
    where fa.id = form_responses.assignment_id and eu.user_id = auth.uid()
  ));

create index idx_form_assignments_event on public.form_assignments(event_id);
create index idx_form_assignments_form on public.form_assignments(form_id);
create index idx_form_responses_assignment on public.form_responses(assignment_id);
create table public.gfh_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  file_url text,
  file_name text,
  visible boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.gfh_resources enable row level security;

create policy "Anyone authenticated can read resources"
  on public.gfh_resources for select
  using (auth.role() = 'authenticated' and visible = true);

create policy "Admins read all resources"
  on public.gfh_resources for select
  using (is_admin(auth.uid()));

create policy "Admins manage resources"
  on public.gfh_resources for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));
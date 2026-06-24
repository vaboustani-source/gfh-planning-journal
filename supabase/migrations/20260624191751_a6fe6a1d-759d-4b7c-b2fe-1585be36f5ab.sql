create table if not exists public.message_reply_routes (
  token text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists message_reply_routes_event_id_key
  on public.message_reply_routes(event_id);

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  postmark_message_id text unique,
  event_id uuid references public.events(id) on delete set null,
  from_email text,
  matched_user_id uuid references public.users(id) on delete set null,
  status text not null,
  created_message_id uuid references public.messages(id) on delete set null,
  subject text,
  created_at timestamptz not null default now()
);

grant select on public.message_reply_routes to authenticated;
grant all on public.message_reply_routes to service_role;
grant select on public.inbound_emails to authenticated;
grant all on public.inbound_emails to service_role;

alter table public.message_reply_routes enable row level security;
alter table public.inbound_emails enable row level security;

create policy "admins read reply routes" on public.message_reply_routes
  for select using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "admins read inbound emails" on public.inbound_emails
  for select using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
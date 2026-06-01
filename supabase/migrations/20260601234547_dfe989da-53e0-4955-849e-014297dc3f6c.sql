-- Contracts table
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  document_type text default 'contract' check (document_type in ('contract', 'addendum', 'beo', 'invoice_agreement')),
  content text not null,
  content_hash text,
  status text default 'draft' check (status in ('draft', 'sent', 'partially_signed', 'fully_signed', 'voided')),
  requires_both_partners boolean default false,
  sent_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.contracts to authenticated;
grant all on public.contracts to service_role;

alter table public.contracts enable row level security;

create policy "Admins manage contracts" on public.contracts
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Event members read their contracts" on public.contracts
  for select to authenticated
  using (exists (
    select 1 from public.event_users
    where event_id = contracts.event_id and user_id = auth.uid()
  ));

-- Contract signatures: immutable audit trail
create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  signer_name text not null,
  signer_email text not null,
  signer_user_id uuid references auth.users(id),
  typed_name text not null,
  agreed_to_terms boolean not null default false,
  ip_address text,
  user_agent text,
  content_version_hash text not null,
  signed_at timestamptz not null default now()
);

grant select, insert on public.contract_signatures to authenticated;
grant all on public.contract_signatures to service_role;

alter table public.contract_signatures enable row level security;

create policy "Event members read signatures" on public.contract_signatures
  for select to authenticated
  using (exists (
    select 1 from public.contracts c
    join public.event_users eu on eu.event_id = c.event_id
    where c.id = contract_signatures.contract_id and eu.user_id = auth.uid()
  ));

create policy "Admins read signatures" on public.contract_signatures
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy "Authenticated can sign" on public.contract_signatures
  for insert to authenticated with check (true);
-- NO update or delete policies - signatures are immutable by design

create index if not exists idx_contracts_event on public.contracts(event_id);
create index if not exists idx_contract_signatures_contract on public.contract_signatures(contract_id);
alter table public.guests 
  add column if not exists rsvp_token text unique,
  add column if not exists rsvp_submitted_at timestamptz,
  add column if not exists rsvp_source text default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'guests_rsvp_source_check'
  ) then
    alter table public.guests
      add constraint guests_rsvp_source_check
      check (rsvp_source in ('manual', 'rsvp_app', 'admin'));
  end if;
end $$;
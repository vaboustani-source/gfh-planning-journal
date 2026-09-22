-- Re-sync milestones when a wedding date changes (Sept 22 2026)
--
-- Milestones were only computed once, when the event was created. Correcting a
-- wrong wedding date (Samantha Zingernan & Elliot Belfer: 9/21/26 -> 8/21/27)
-- left every milestone on the old schedule and most of them showed overdue.
--
-- This trigger re-applies milestone_template() to every milestone that is not
-- yet complete whenever events.wedding_date changes. Completed milestones keep
-- their dates. The onboarding date stays the event's created_at, same as the
-- Sept 9 backfill. If a lodging block already mirrors the event, its dates
-- follow too.

create or replace function public.resync_event_dates()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.wedding_date is not null and new.wedding_date is distinct from old.wedding_date then
    update public.milestones m
    set timeframe_label = t.timeframe_label,
        target_date     = t.target_date,
        status          = case when t.target_date < current_date then 'overdue' else 'pending' end
    from public.milestone_template(new.wedding_date, new.created_at::date) t
    where m.event_id = new.id
      and m.sort_order = t.sort_order
      and m.status not in ('complete', 'completed')
      and m.completed_date is null;
  end if;

  if new.wedding_date is distinct from old.wedding_date
     or new.arrival_date is distinct from old.arrival_date
     or new.departure_date is distinct from old.departure_date then
    update public.lb_events l
    set wedding_date   = new.wedding_date,
        check_in_date  = new.arrival_date,
        check_out_date = new.departure_date,
        nights         = greatest(coalesce(new.departure_date - new.arrival_date, 2), 1)
    where l.id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_resync_event_dates on public.events;
create trigger trg_resync_event_dates
  after update of wedding_date, arrival_date, departure_date on public.events
  for each row execute function public.resync_event_dates();

-- Repair any event whose open milestones drifted from its current wedding date.
update public.milestones m
set timeframe_label = t.timeframe_label,
    target_date     = t.target_date,
    status          = case when t.target_date < current_date then 'overdue' else 'pending' end
from public.events e
cross join lateral public.milestone_template(e.wedding_date, e.created_at::date) t
where m.event_id = e.id
  and m.sort_order = t.sort_order
  and e.wedding_date is not null
  and m.status not in ('complete', 'completed')
  and m.completed_date is null
  and m.target_date is distinct from t.target_date;

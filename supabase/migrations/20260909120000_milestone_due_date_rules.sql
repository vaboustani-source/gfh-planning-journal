-- Milestone due-date rules (Sept 2026 update)
--
-- 1. A single template function, milestone_template(), now decides every
--    milestone's title, label, owner and internal due date. seed_milestones()
--    uses it for new events, and the backfill at the bottom re-applies it to
--    milestones on existing events that are not yet complete.
-- 2. New generated column milestones.couple_due_date: the date the couple sees.
--    For couple-owned (or shared) milestones it is 3 weeks before the internal
--    due date, giving the couple 3 weeks of grace. Staff-owned milestones show
--    the same date to both sides.
--
-- Rules encoded here:
--   Planning Call #1 (kick-off)    within 3 weeks of onboarding
--   Catering Call #1               November of the prior year for Jan-Jul weddings,
--                                  December of the prior year for Aug-Dec weddings.
--                                  Late bookings roll to the next window (Dec, then Jan).
--   Proposed menu sent / approved  2 and 4 weeks after Catering Call #1
--   Bar selections discussed       at Catering Call #1
--   Tasting scheduled              2 weeks after Catering Call #1
--   Tasting complete               by end of February of the wedding year
--   Final menu and bar approved    2 weeks after the tasting
--   Lodging guest list             window is 6 to 3 months out, due at 3 months
--   Planning Call #2               90 days
--   Final headcounts, Planning Call #3, timeline to vendors   30 days
--   Check-in email                 7 days
--   Event Manager checks in with all vendors   48 hours

create or replace function public.milestone_template(p_wedding_date date, p_onboarded date default current_date)
returns table (sort_order integer, title text, timeframe_label text, target_date date, owner text)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_wmonth integer := extract(month from p_wedding_date)::integer;
  v_wyear integer := extract(year from p_wedding_date)::integer;
  v_prior integer := extract(year from p_wedding_date)::integer - 1;
  v_onboarded date := coalesce(p_onboarded, current_date);
  v_catering date;
  v_catering_label text;
  v_tasting date;
begin
  -- Catering Call #1 window
  if v_wmonth >= 8 then
    v_catering := make_date(v_prior, 12, 31);
    v_catering_label := 'December, year before the wedding';
  else
    v_catering := make_date(v_prior, 11, 30);
    v_catering_label := 'November, year before the wedding';
  end if;

  -- Booked after their window closed: roll to the next availability
  if v_catering < v_onboarded then
    if make_date(v_prior, 12, 31) >= v_onboarded then
      v_catering := make_date(v_prior, 12, 31);
      v_catering_label := 'December, year before the wedding (next available)';
    elsif make_date(v_wyear, 1, 31) >= v_onboarded then
      v_catering := make_date(v_wyear, 1, 31);
      v_catering_label := 'January of the wedding year (next available)';
    else
      v_catering := v_onboarded + 30;
      v_catering_label := 'Next available (late booking)';
    end if;
  end if;

  -- Tasting: one of three dates in Jan/Feb of the wedding year
  v_tasting := make_date(v_wyear, 2, 28);
  if v_tasting < v_catering + 30 then
    v_tasting := v_catering + 30;
  end if;
  if v_tasting > p_wedding_date - 60 then
    v_tasting := p_wedding_date - 60;
  end if;

  return query
  select * from (values
    (1,  'Planning Call #1: Review portal and kick-off planning',
         'Within 3 weeks of onboarding',            v_onboarded + 21,           'brandon'),
    (2,  'Catering Call #1: Review and discuss menus',
         v_catering_label,                          v_catering,                 'brandon'),
    (3,  'Proposed menu and invoice sent to couple for review',
         '2 weeks after Catering Call #1',          v_catering + 14,            'brandon'),
    (4,  'Proposed menu approved',
         '4 weeks after Catering Call #1',          v_catering + 28,            'both'),
    (5,  'Tasting scheduled',
         'Pick one of the January/February tasting dates', v_catering + 14,     'couple'),
    (6,  'Bar selections discussed',
         'At Catering Call #1',                     v_catering,                 'both'),
    (7,  'Tasting complete',
         'January/February of the wedding year',    v_tasting,                  'both'),
    (8,  'Final menu & bar selections approved',
         '2 weeks post-tasting',                    v_tasting + 14,             'both'),
    (9,  'On-site lodging guest list due',
         '6 to 3 months before the wedding',        p_wedding_date - 90,        'couple'),
    (10, 'Planning Call #2: Review vendor info, timeline, table layouts, decor',
         '90 days',                                 p_wedding_date - 90,        'brandon'),
    (11, 'Final guest headcounts due and locked in',
         '30 days',                                 p_wedding_date - 30,        'couple'),
    (12, 'Planning Call #3: Check-in call to finalize the Google file and all details. You should be done planning!',
         '30 days',                                 p_wedding_date - 30,        'brandon'),
    (13, 'Event Manager sends timeline to vendors for review and approval',
         '30 days',                                 p_wedding_date - 30,        'brandon'),
    (14, 'Check-in email sent to couple & on-site guests',
         '7 days',                                  p_wedding_date - 7,         'brandon'),
    (15, 'Event Manager checks in with all vendors',
         '48 hours',                                p_wedding_date - 2,         'brandon')
  ) as t(sort_order, title, timeframe_label, target_date, owner);
end;
$function$;

-- The couple-facing date: 3 weeks of grace on anything the couple owns or shares.
alter table public.milestones
  add column if not exists couple_due_date date
  generated always as (
    case when owner in ('couple', 'both') then target_date - 21 else target_date end
  ) stored;

create or replace function public.seed_milestones(p_event_id uuid, p_wedding_date date)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.milestones where event_id = p_event_id) then
    return;
  end if;

  insert into public.milestones (event_id, title, timeframe_label, target_date, status, owner, sort_order)
  select p_event_id, t.title, t.timeframe_label, t.target_date,
         case when t.target_date < current_date then 'overdue' else 'pending' end,
         t.owner, t.sort_order
  from public.milestone_template(p_wedding_date, current_date) t;
end;
$function$;

-- Backfill: re-apply the template to every milestone that is not yet complete.
-- Matches on sort_order (1 to 15), which is stable across all seeded events.
update public.milestones m
set title           = t.title,
    timeframe_label = t.timeframe_label,
    target_date     = t.target_date,
    owner           = t.owner,
    status          = case when t.target_date < current_date then 'overdue' else 'pending' end
from public.events e
cross join lateral public.milestone_template(e.wedding_date, e.created_at::date) t
where m.event_id = e.id
  and m.sort_order = t.sort_order
  and e.wedding_date is not null
  and m.status not in ('complete', 'completed')
  and m.completed_date is null;

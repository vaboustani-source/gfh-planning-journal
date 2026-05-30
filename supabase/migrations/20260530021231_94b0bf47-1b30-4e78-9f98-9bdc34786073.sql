
-- Add missing columns to notification_log
alter table public.notification_log
  add column if not exists type text,
  add column if not exists message text,
  add column if not exists created_at timestamp with time zone not null default now();

-- Idempotent: unschedule any prior versions
do $$
declare v_name text;
begin
  foreach v_name in array array[
    'keepalive',
    'process-message-queue',
    'daily-payment-check',
    'daily-milestone-check',
    'weekly-form-reminder',
    'daily-stale-conversation-check',
    'admin-daily-digest'
  ] loop
    if exists (select 1 from cron.job where jobname = v_name) then
      perform cron.unschedule(v_name);
    end if;
  end loop;
end $$;

-- 1) Keepalive
select cron.schedule(
  'keepalive',
  '*/5 * * * *',
  $$select count(*) from public.events$$
);

-- 2) Process message queue
select cron.schedule(
  'process-message-queue',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/process-message-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnpjYm5obGpwcml3dXZ4c2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDMxMTUsImV4cCI6MjA4OTk3OTExNX0.tOBznnC2AaFKWw1QYV-B223XB-If6aBogL2q-sWkbs8'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 3) Daily payment check (13:00 UTC ≈ 8am ET)
select cron.schedule(
  'daily-payment-check',
  '0 13 * * *',
  $$
  update public.payment_schedule
  set status = case
    when paid = true then 'paid'
    when due_date < current_date then 'overdue'
    when due_date <= current_date + interval '14 days' then 'due_soon'
    else 'upcoming'
  end
  where paid = false or status is distinct from 'paid';
  $$
);

-- 4) Daily milestone check (uses target_date, not due_date)
select cron.schedule(
  'daily-milestone-check',
  '0 13 * * *',
  $$
  update public.milestones
  set status = 'overdue'
  where target_date < current_date
    and status not in ('complete', 'completed', 'overdue')
    and target_date is not null;
  $$
);

-- 5) Weekly form reminder (Mondays 14:00 UTC ≈ 9am ET)
select cron.schedule(
  'weekly-form-reminder',
  '0 14 * * 1',
  $$
  insert into public.notification_log (event_id, type, message, created_at)
  select
    fa.event_id,
    'form_reminder',
    'Form "' || f.title || '" has not been started',
    now()
  from public.form_assignments fa
  join public.forms f on f.id = fa.form_id
  where fa.status = 'not_started'
    and fa.created_at < now() - interval '7 days';
  $$
);

-- 6) Daily stale conversation check
select cron.schedule(
  'daily-stale-conversation-check',
  '0 13 * * *',
  $$
  insert into public.notification_log (event_id, type, message, created_at)
  select
    e.id,
    'stale_conversation',
    'No messages in 14+ days',
    now()
  from public.events e
  where e.status <> 'completed'
    and not exists (
      select 1 from public.messages m
      where m.event_id = e.id
        and m.created_at > now() - interval '14 days'
    );
  $$
);

-- 7) Admin daily digest (12:00 UTC ≈ 7am ET)
select cron.schedule(
  'admin-daily-digest',
  '0 12 * * *',
  $$
  insert into public.notification_log (type, message, created_at)
  select
    'daily_digest',
    json_build_object(
      'overdue_milestones',  (select count(*) from public.milestones where status = 'overdue'),
      'payments_due_soon',   (select count(*) from public.payment_schedule where status = 'due_soon'),
      'unread_messages',     (select count(*) from public.messages where read_at is null),
      'stale_conversations', (select count(*) from public.notification_log where type = 'stale_conversation' and created_at > now() - interval '24 hours')
    )::text,
    now();
  $$
);

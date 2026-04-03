
SELECT cron.schedule(
  'process-message-queue',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/process-message-queue',
        headers:=concat('{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnpjYm5obGpwcml3dXZ4c2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDMxMTUsImV4cCI6MjA4OTk3OTExNX0.tOBznnC2AaFKWw1QYV-B223XB-If6aBogL2q-sWkbs8"}')::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);

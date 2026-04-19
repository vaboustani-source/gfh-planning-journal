

## Problem
Recovery email arrived from `noreply@mail.app.supabase.io` (Supabase default), not your branded `notify.gilbertsvillefarmhouse.com` template. Auth logs confirm Supabase Auth fired `mail.send` directly without invoking the `auth-email-hook` Edge Function (zero logs on that function).

Domain is verified ✅, function is deployed ✅, but the hook is **not wired into Supabase Auth's webhook config** on the Lovable Cloud side.

## Fix Plan

1. **Re-run the managed auth-email setup** by re-scaffolding `auth-email-hook` with overwrite. This re-registers the hook with the Supabase Auth `send_email_hook` webhook config and re-toggles Project Emails on. Your custom templates are preserved (the scaffold only rewrites `index.ts` + deno.json — your branded `recovery.tsx` etc. stay).
2. **Redeploy** `auth-email-hook` so the latest code is live.
3. **Verify** by triggering one more password reset for `vaboustani@gmail.com` and checking:
   - `auth-email-hook` Edge Function logs now show invocation
   - `email_send_log` table shows a `pending` → `sent` row
   - Email arrives from `noreply@gilbertsvillefarmhouse.com` with the sage-green branded template

If after re-scaffolding the auth log still shows `mail_from: noreply@mail.app.supabase.io`, the issue is the Project Emails toggle in Cloud → Emails — I'll walk you through flipping it again.

## Why this works
The "Custom auth emails" toggle you turned on enables the user-facing setting, but the Supabase Auth `send_email_hook` URL config is provisioned by the scaffold/setup orchestration. Re-scaffolding triggers Lovable's reconciler to re-register the webhook URL with Supabase Auth, which is what was missing.


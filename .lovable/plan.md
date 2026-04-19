
Problem summary

This is now two separate issues:

1. The branded template exists, but auth emails are still being sent by Supabase’s default sender, which means the custom auth email hook is still not the path actually being used for delivery.
2. The email link flow is inconsistent because auth URLs are pointing at mixed domains/origins, so even when the email arrives, the return-to-app flow is unreliable.

What I found

- The branded invite and recovery templates are present and look correct.
- The auth hook code is set up to send from `noreply@gilbertsvillefarmhouse.com` via `notify.gilbertsvillefarmhouse.com`.
- The password page already includes PKCE code exchange support, so the earlier “stuck spinner” bug was partly addressed.
- But auth URLs are inconsistent across the app:
  - `invite-participant` falls back to `https://plan.gilbertsvillefarmhouse.com/set-password`
  - the auth hook hardcodes `gilbertsvillefarmhouse.com`
  - the client sends `window.location.origin`
  - the project metadata currently shows no custom domain attached to the app itself
- That mismatch is the strongest reason the email link is not reliably bringing users back into the real portal flow.

Implementation plan

1. Re-stabilize the auth email sender path
- Re-register the custom auth email hook so Supabase Auth routes invite/recovery emails through the branded hook instead of the default sender.
- Re-check project email status and hook activation after that.
- Verify the next resend produces hook activity and no longer sends from the Supabase domain.

2. Unify all auth redirect URLs
- Replace mixed hardcoded domains and `window.location.origin` usage with one shared, canonical app base URL for auth flows.
- Use that same canonical URL for:
  - password reset emails
  - invite emails
  - post-password landing
  - auth email template links
- This prevents preview URLs, stale domains, and non-connected domains from leaking into emails.

3. Harden the `/set-password` flow end-to-end
- Keep PKCE exchange support, but make the page more defensive:
  - read auth errors from both query string and hash
  - handle expired/invalid links cleanly
  - stop any possible indefinite loading state
- After a successful password set, route the user into the correct next step instead of leaving them in a vague handoff.

4. Fix the portal handoff after email click
- Decide the post-success behavior and make it deterministic:
  - preferred: send the user directly into their portal if a valid session exists
  - fallback: take them to login with a clear success state if the session is not usable
- Ensure this works for both:
  - first-time invite / set-password
  - forgot-password reset flow

5. Verify the full flow with real auth events
- Test resend invite
- Test first-time password setup from the email
- Test forgot-password from login
- Confirm:
  - sender is branded, not Supabase
  - correct template is used
  - link lands on the right domain
  - password can be set
  - user reaches login/portal correctly afterward

Technical details

- I would centralize the auth URL instead of spreading it across edge functions and client pages.
- I would update `invite-participant`, the login reset flow, and `auth-email-hook` to all use the same live app URL.
- I would keep the existing branded TSX templates and only adjust link/config plumbing unless testing shows a template prop issue.
- If the auth hook still does not fire after re-registration, that confirms the remaining problem is platform wiring rather than template code.

Expected outcome

After this fix:
- emails should come from your branded domain
- the same branded template should continue rendering
- clicking the email link should take users through a working password/reset flow
- users should end up back in the real portal flow, not a dead or mismatched domain

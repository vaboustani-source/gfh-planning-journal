/**
 * Canonical app base URL for ALL Edge Functions.
 *
 * Single source of truth for any URL pointing back at the app — auth email
 * redirects, message notification CTAs, invite links, etc.
 *
 * Resolution:
 *   1. APP_BASE_URL env var (set as an Edge Function secret to override)
 *   2. Hardcoded production fallback
 *
 * Always returns origin without trailing slash.
 */
export const APP_BASE_URL: string = (() => {
  const fromEnv = Deno.env.get('APP_BASE_URL')
  const base = (fromEnv && fromEnv.trim()) || 'https://plan.gilbertsvillefarmhouse.com'
  return base.replace(/\/+$/, '')
})()

/** URL for the set-password / accept-invite landing page. */
export function getSetPasswordUrl(): string {
  return `${APP_BASE_URL}/set-password`
}

/** URL for the messages thread (couple portal or admin all-messages view). */
export function getThreadUrl(role: 'admin' | 'couple', _eventId?: string): string {
  if (role === 'admin') return `${APP_BASE_URL}/admin/messages`
  return `${APP_BASE_URL}/portal/messages`
}

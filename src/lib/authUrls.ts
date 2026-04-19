/**
 * Canonical app URL used for all auth email links (invite, recovery, set-password).
 *
 * Order of resolution:
 * 1. VITE_APP_URL env override (set this in production to lock the domain)
 * 2. window.location.origin (dev / preview)
 *
 * Always returns origin without trailing slash.
 */
export function getAppBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_APP_URL as string | undefined;
  const base = (envUrl && envUrl.trim()) || window.location.origin;
  return base.replace(/\/+$/, "");
}

export function getSetPasswordUrl(): string {
  return `${getAppBaseUrl()}/set-password`;
}

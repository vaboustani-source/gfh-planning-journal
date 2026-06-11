/**
 * Branded GFH email shell + template render helper.
 *
 * Loads a row from public.email_templates by key, substitutes {{variable}}
 * tokens in subject/heading/body/cta_label, wraps the result in the shared
 * Gilbertsville Farmhouse branded HTML shell, and returns the final subject
 * and HTML.
 *
 * CRITICAL: every known key has a hardcoded fallback below. If the DB row
 * is missing or the fetch fails, the email still sends with the original
 * copy. Sending must never break.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface TemplateRow {
  subject: string
  heading: string | null
  body: string
  cta_label: string | null
}

export interface RenderOptions {
  /** Variables substituted into {{name}} tokens. */
  variables?: Record<string, string | undefined | null>
  /** Optional CTA link. If present and cta_label is non-empty, a button is rendered. */
  ctaUrl?: string
}

export interface RenderedEmail {
  subject: string
  html: string
}

/** Built-in fallback copy for every known key. Mirrors what was sent before. */
const FALLBACKS: Record<string, TemplateRow> = {
  invitation_staff: {
    subject: "You've been invited to the Gilbertsville Farmhouse team",
    heading: 'Welcome.',
    body: '{{greeting}}\n\nYou have been invited to join the Gilbertsville Farmhouse Planning Journal team. When you set up your access, you will be able to sign in and begin working alongside us right away.',
    cta_label: 'Set Up Your Access',
  },
  invitation_couple: {
    subject: 'Your wedding planning portal is ready',
    heading: 'Welcome.',
    body: '{{greeting}}\n\nYour private planning portal at Gilbertsville Farmhouse is ready for you. Once you set up your access, you will land directly inside your wedding portal where everything for your weekend lives in one calm place.',
    cta_label: 'Set Up Your Access',
  },
  invitation_participant: {
    subject: '{{inviter_name}} has added you to {{event_title}}',
    heading: 'Welcome.',
    body: '{{greeting}}\n\nYou have been invited to help with {{event_title}} at Gilbertsville Farmhouse. Setting up your access takes about a minute, then you will land directly inside the parts of the portal that are yours to help with.',
    cta_label: 'Set Up Your Access',
  },
  contract_signed_receipt: {
    subject: 'Signature receipt: {{contract_title}}',
    heading: 'Signature Confirmed',
    body: 'Dear {{signer_name}},\n\nThis is your receipt for the agreement you just signed: {{contract_title}}.\n\nSigned on {{signed_date}}.\n\nA copy is saved in your portal under Agreements for your records. If anything looks incorrect, please reply to this email right away.',
    cta_label: null,
  },
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function substitute(input: string | null | undefined, vars: Record<string, string | undefined | null>): string {
  if (!input) return ''
  return input.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name) => {
    const v = vars[name]
    return v == null ? '' : String(v)
  })
}

function bodyToHtml(plain: string): string {
  const escaped = escapeHtml(plain)
  // Preserve line breaks. Double newline becomes paragraph break.
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#55615a;margin:0 0 16px;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function wrapShell(opts: { heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<div style="text-align:center;margin:16px 0 12px;">
         <a href="${opts.ctaUrl}" style="display:inline-block;background:#2C3E2D;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:6px;font-size:14px;letter-spacing:0.06em;">${escapeHtml(opts.ctaLabel)}</a>
       </div>`
    : ''

  const heading = opts.heading
    ? `<h1 style="font-family:Georgia,'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#2C3E2D;margin:0 0 18px;letter-spacing:0.02em;">${escapeHtml(opts.heading)}</h1>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,'Times New Roman',serif;color:#2C3E2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F4;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #E8E2D9;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:36px 40px 16px;text-align:center;border-bottom:1px solid #F0EDE6;">
          <div style="font-family:Georgia,'Cormorant Garamond',serif;font-size:22px;letter-spacing:0.06em;color:#2C3E2D;font-weight:300;">Gilbertsville Farmhouse</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#C9A84C;letter-spacing:0.18em;margin-top:6px;text-transform:uppercase;">Planning Journal</div>
        </td></tr>
        <tr><td style="padding:32px 40px 24px;">
          ${heading}
          ${opts.bodyHtml}
          ${cta}
        </td></tr>
        <tr><td style="padding:20px 40px 28px;text-align:center;border-top:1px solid #F0EDE6;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa097;letter-spacing:0.08em;">GILBERTSVILLE FARMHOUSE</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa097;margin-top:4px;">A private estate in upstate New York</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function loadTemplate(key: string): Promise<TemplateRow> {
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return FALLBACKS[key]
    const supabase = createClient(url, serviceKey)
    const { data, error } = await supabase
      .from('email_templates')
      .select('subject, heading, body, cta_label')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return FALLBACKS[key] ?? { subject: '', heading: '', body: '', cta_label: null }
    return data as TemplateRow
  } catch (e) {
    console.error('[email-shell] loadTemplate failed for key=' + key, e)
    return FALLBACKS[key] ?? { subject: '', heading: '', body: '', cta_label: null }
  }
}

/**
 * Render a template by key with the given variables and optional CTA url.
 * Returns final subject and HTML, always. Never throws on DB problems.
 */
export async function renderTemplate(key: string, opts: RenderOptions = {}): Promise<RenderedEmail> {
  const vars = opts.variables ?? {}
  let row = await loadTemplate(key)
  if (!row || !row.body) {
    row = FALLBACKS[key] ?? { subject: '', heading: '', body: '', cta_label: null }
  }

  const subject = substitute(row.subject, vars)
  const heading = substitute(row.heading, vars)
  const bodyText = substitute(row.body, vars)
  const ctaLabel = substitute(row.cta_label, vars)

  const html = wrapShell({
    heading,
    bodyHtml: bodyToHtml(bodyText),
    ctaLabel: ctaLabel || undefined,
    ctaUrl: opts.ctaUrl,
  })

  return { subject, html }
}

export { FALLBACKS as EMAIL_FALLBACKS }

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
  /** Variables substituted into {{name}} tokens in subject/heading/body/cta_label. */
  variables?: Record<string, string | undefined | null>
  /** Optional CTA link. If present and cta_label is non-empty, a button is rendered. */
  ctaUrl?: string
  /**
   * Trusted system-generated HTML inserted between the heading and the body.
   * Used for repeating blocks (message bubbles, details tables) that should
   * not be editable as copy. NOT escaped — only pass HTML the function itself
   * built, never anything derived from user-editable template fields.
   */
  contentHtml?: string
  /**
   * Override the shell to render with a specific shell style. Default 'standard'.
   * Reserved for future use.
   */
  shell?: 'standard'
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
  notify_admin_messages: {
    subject: '{{status_prefix}}[GFH] {{partner_label}} — {{status_suffix}}',
    heading: '{{partner_label}}',
    body: '{{subline}}',
    cta_label: 'Open Thread',
  },
  notify_couple_message: {
    subject: 'A note from Brandon at Gilbertsville',
    heading: 'A note from Brandon.',
    body: 'Reply in your Planning Hub — we will see it and respond.',
    cta_label: 'Open the Planning Hub',
  },
  notify_couple_messages_batch: {
    subject: '{{count}} new notes from Brandon at Gilbertsville',
    heading: 'A note from Brandon.',
    body: 'Reply in your Planning Hub — we will see it and respond.',
    cta_label: 'Open the Planning Hub',
  },
  event_handoff_notice: {
    subject: 'New client to onboard: {{event_title}}',
    heading: 'A new client is ready for you.',
    body: '{{handler_name}} has finished the sales setup and handed this wedding over for planning.\n\nWhen you\'ve finished configuring the wedding, click "Open Portal for Client" to invite the couple in.',
    cta_label: 'Open This Wedding',
  },
  payment_reminder: {
    subject: 'A friendly note about your upcoming payment',
    heading: 'A friendly reminder.',
    body: 'Hello {{couple_names}},\n\nThis is a friendly reminder that your next payment of {{amount}} is scheduled for {{due_date}}.\n\nYou can review the full schedule and submit your payment from your Planning Hub. If anything has changed on your end, just reply to this note and we will take care of it together.',
    cta_label: 'Open Your Planning Hub',
  },
  wedding_countdown: {
    subject: 'Your wedding at Gilbertsville Farmhouse is {{days_out}} days away',
    heading: 'The day is getting close.',
    body: 'Hello {{couple_names}},\n\nWe wanted to send a quick note: your wedding on {{wedding_date}} is just {{days_out}} days away. We have been thinking about your weekend and looking forward to welcoming you to the estate.\n\nIf anything is sitting on your mind, the Planning Hub is the best place to capture it so we can move on it together.',
    cta_label: 'Open Your Planning Hub',
  },
  post_wedding_thankyou: {
    subject: 'Thank you for celebrating with us at Gilbertsville',
    heading: 'Thank you.',
    body: 'Hello {{couple_names}},\n\nWe are still smiling from your weekend at Gilbertsville Farmhouse. Thank you for trusting us with such an important chapter, and for the care you brought to every detail.\n\nYour Planning Hub will stay open for a while so you can revisit notes, vendor contacts, and photos as they come in. If there is anything we can help wrap up, just reply to this note.',
    cta_label: 'Open Your Planning Hub',
  },
  nudge_guestlist: {
    subject: 'A gentle nudge about your guest list',
    heading: 'Your guest list is waiting.',
    body: 'Hello {{couple_names}},\n\nWe noticed your guest list at Gilbertsville Farmhouse has not been started yet. With {{days_out}} days until your wedding on {{wedding_date}}, this is a good moment to begin adding names.\n\nThere is no rush to have it perfect. Start with the people you know for certain, and you can add or adjust the rest over the coming weeks. Once your list is in, we can help you with seating, lodging, and meal counts.\n\nIf anything is making this feel difficult, reply to this note and we will work through it with you.',
    cta_label: 'Open Your Guest List',
  },
  nudge_forms: {
    subject: 'A friendly reminder about a few open forms',
    heading: 'A few forms are still waiting.',
    body: 'Hello {{couple_names}},\n\nA handful of the forms in your Planning Hub are still open with {{days_out}} days to go until your wedding on {{wedding_date}}.\n\nWhen you have a quiet moment, the Forms section will show you exactly what is left and how long each one takes. Most of them are short. Getting them in now means we can build the rest of your weekend around your answers.\n\nIf a question on any form is unclear, reply here and we will sort it out together.',
    cta_label: 'Open Your Forms',
  },
  nudge_timeline: {
    subject: 'A gentle nudge about your ceremony details',
    heading: 'Your ceremony details are waiting.',
    body: 'Hello {{couple_names}},\n\nYour ceremony and key day-of details at Gilbertsville Farmhouse are not finalized yet. With {{days_out}} days until your wedding on {{wedding_date}}, this is a good moment to walk through them.\n\nThe Ceremony section in your Planning Hub covers things like your officiant, processional order, first dance, and the small choices that shape the day. You can save as you go and finalize once it feels right.\n\nIf you want to talk anything through before locking it in, reply to this note and we will help.',
    cta_label: 'Open Ceremony Details',
  },
  nudge_menu: {
    subject: 'A gentle nudge about your menu and meal choices',
    heading: 'Your menu is waiting for the final touch.',
    body: 'Hello {{couple_names}},\n\nYour Menus and Meals area at Gilbertsville Farmhouse has not been finalized yet. With {{days_out}} days to go until your wedding on {{wedding_date}}, this is a lovely moment to look it over together and lock in your choices.\n\nThe Menus and Meals section in your Planning Hub gathers everything in one place: meal preferences, headcounts, dietary needs, and bar selections. You can step through each tab at your own pace, save as you go, and then mark the whole area finalized when it feels right. There is still plenty of time, and nothing needs to be perfect on the first pass.\n\nIf any question is making it feel harder than it should, reply to this note and we will walk through it with you.',
    cta_label: 'Open Your Menu',
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
  if (!plain) return ''
  const escaped = escapeHtml(plain)
  // Preserve line breaks. Double newline becomes paragraph break.
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#55615a;margin:0 0 16px;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function wrapShell(opts: { heading: string; bodyHtml: string; contentHtml?: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<div style="text-align:center;margin:16px 0 12px;">
         <a href="${opts.ctaUrl}" style="display:inline-block;background:#2C3E2D;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:6px;font-size:14px;letter-spacing:0.06em;">${escapeHtml(opts.ctaLabel)}</a>
       </div>`
    : ''

  const heading = opts.heading
    ? `<h1 style="font-family:Georgia,'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#2C3E2D;margin:0 0 18px;letter-spacing:0.02em;">${escapeHtml(opts.heading)}</h1>`
    : ''

  const content = opts.contentHtml ? `<div style="margin:0 0 16px;">${opts.contentHtml}</div>` : ''

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
          ${content}
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
  if (!row || (!row.body && !row.heading && !row.subject)) {
    row = FALLBACKS[key] ?? { subject: '', heading: '', body: '', cta_label: null }
  }

  const subject = substitute(row.subject, vars)
  const heading = substitute(row.heading, vars)
  const bodyText = substitute(row.body, vars)
  const ctaLabel = substitute(row.cta_label, vars)

  const html = wrapShell({
    heading,
    bodyHtml: bodyToHtml(bodyText),
    contentHtml: opts.contentHtml,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: opts.ctaUrl,
  })

  return { subject, html }
}

export { FALLBACKS as EMAIL_FALLBACKS }

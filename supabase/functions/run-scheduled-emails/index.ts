/**
 * Daily runner for automated, date-based emails.
 *
 * Reads scheduled_emails (config). Only enabled rows do anything.
 * For each enabled row, finds targets whose date matches today +/- an offset,
 * skips ones already in scheduled_email_log, renders the template, sends,
 * and writes a dedup log row.
 *
 * Safety: every row ships disabled. Per-record errors are caught and logged.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { renderTemplate } from '../_shared/email-shell.ts'
import { APP_BASE_URL } from '../_shared/appUrls.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PORTAL_URL = `${APP_BASE_URL}/portal`

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatAmount(n: number | string | null): string {
  if (n == null) return ''
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (!isFinite(v)) return ''
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function coupleLabel(p1: string | null, p2: string | null, fallback: string): string {
  const a = (p1 || '').trim()
  const b = (p2 || '').trim()
  if (a && b) return `${a} & ${b}`
  return a || b || fallback
}

function dateOffset(base: Date, offsetDays: number, direction: 'before' | 'after'): string {
  // returns YYYY-MM-DD of base +/- offsetDays
  const d = new Date(base)
  d.setUTCHours(0, 0, 0, 0)
  const delta = direction === 'before' ? offsetDays : -offsetDays
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

async function getCoupleRecipients(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<{ emails: string[]; p1: string | null; p2: string | null; eventTitle: string; weddingDate: string | null }> {
  const { data: evt } = await supabase
    .from('events')
    .select('title, wedding_date, partner1_name, partner2_name')
    .eq('id', eventId)
    .single()

  const { data: eu } = await supabase
    .from('event_users')
    .select('user_id, role_in_event')
    .eq('event_id', eventId)

  const userIds = (eu || []).map((r: any) => r.user_id).filter(Boolean)
  let emails: string[] = []
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, role')
      .in('id', userIds)
    emails = (users || [])
      .filter((u: any) => u.email && u.role === 'couple')
      .map((u: any) => u.email as string)
  }
  return {
    emails,
    p1: evt?.partner1_name ?? null,
    p2: evt?.partner2_name ?? null,
    eventTitle: evt?.title ?? 'Wedding',
    weddingDate: evt?.wedding_date ?? null,
  }
}

async function alreadyLogged(supabase: any, key: string, targetId: string, marker: string): Promise<boolean> {
  const { data } = await supabase
    .from('scheduled_email_log')
    .select('id')
    .eq('key', key)
    .eq('target_id', targetId)
    .eq('marker', marker)
    .maybeSingle()
  return !!data
}

async function logSent(supabase: any, key: string, targetId: string, marker: string): Promise<void> {
  await supabase.from('scheduled_email_log').insert({ key, target_id: targetId, marker })
}

interface PerKeyCount { sent: number; skipped: number; failed: number }

async function runPaymentReminder(supabase: any, offsets: number[]): Promise<PerKeyCount> {
  const stats: PerKeyCount = { sent: 0, skipped: 0, failed: 0 }
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (const offset of offsets) {
    const targetDate = dateOffset(today, offset, 'before')
    const { data: installments, error } = await supabase
      .from('payment_schedule')
      .select('id, event_id, amount, due_date, paid, label')
      .eq('due_date', targetDate)
      .eq('paid', false)
    if (error) {
      console.error('[payment_reminder] fetch error', error)
      continue
    }
    for (const row of installments || []) {
      try {
        if (await alreadyLogged(supabase, 'payment_reminder', row.id, String(offset))) {
          stats.skipped++
          continue
        }
        const ctx = await getCoupleRecipients(supabase, row.event_id)
        if (ctx.emails.length === 0) { stats.skipped++; continue }
        const names = coupleLabel(ctx.p1, ctx.p2, ctx.eventTitle)
        const rendered = await renderTemplate('payment_reminder', {
          variables: {
            couple_names: names,
            amount: formatAmount(row.amount),
            due_date: formatDate(row.due_date),
            portal_link: PORTAL_URL,
            days_until: String(offset),
          },
          ctaUrl: PORTAL_URL,
        })
        for (const to of ctx.emails) {
          await sendEmail({ to, subject: rendered.subject, html: rendered.html })
        }
        await logSent(supabase, 'payment_reminder', row.id, String(offset))
        stats.sent++
      } catch (e) {
        console.error('[payment_reminder] failed for installment', row.id, e)
        stats.failed++
      }
    }
  }
  return stats
}

async function runWeddingCountdown(supabase: any, offsets: number[]): Promise<PerKeyCount> {
  const stats: PerKeyCount = { sent: 0, skipped: 0, failed: 0 }
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (const offset of offsets) {
    const targetDate = dateOffset(today, offset, 'before')
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, wedding_date, partner1_name, partner2_name')
      .eq('wedding_date', targetDate)
    if (error) { console.error('[wedding_countdown] fetch error', error); continue }
    for (const evt of events || []) {
      try {
        if (await alreadyLogged(supabase, 'wedding_countdown', evt.id, String(offset))) {
          stats.skipped++; continue
        }
        const ctx = await getCoupleRecipients(supabase, evt.id)
        if (ctx.emails.length === 0) { stats.skipped++; continue }
        const names = coupleLabel(evt.partner1_name, evt.partner2_name, evt.title)
        const rendered = await renderTemplate('wedding_countdown', {
          variables: {
            couple_names: names,
            days_out: String(offset),
            wedding_date: formatDate(evt.wedding_date),
            portal_link: PORTAL_URL,
          },
          ctaUrl: PORTAL_URL,
        })
        for (const to of ctx.emails) {
          await sendEmail({ to, subject: rendered.subject, html: rendered.html })
        }
        await logSent(supabase, 'wedding_countdown', evt.id, String(offset))
        stats.sent++
      } catch (e) {
        console.error('[wedding_countdown] failed for event', evt.id, e)
        stats.failed++
      }
    }
  }
  return stats
}

async function runPostWeddingThankYou(supabase: any, offsets: number[]): Promise<PerKeyCount> {
  const stats: PerKeyCount = { sent: 0, skipped: 0, failed: 0 }
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (const offset of offsets) {
    const targetDate = dateOffset(today, offset, 'after')
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, wedding_date, partner1_name, partner2_name')
      .eq('wedding_date', targetDate)
    if (error) { console.error('[post_wedding_thankyou] fetch error', error); continue }
    for (const evt of events || []) {
      try {
        if (await alreadyLogged(supabase, 'post_wedding_thankyou', evt.id, String(offset))) {
          stats.skipped++; continue
        }
        const ctx = await getCoupleRecipients(supabase, evt.id)
        if (ctx.emails.length === 0) { stats.skipped++; continue }
        const names = coupleLabel(evt.partner1_name, evt.partner2_name, evt.title)
        const rendered = await renderTemplate('post_wedding_thankyou', {
          variables: {
            couple_names: names,
            wedding_date: formatDate(evt.wedding_date),
            portal_link: PORTAL_URL,
          },
          ctaUrl: PORTAL_URL,
        })
        for (const to of ctx.emails) {
          await sendEmail({ to, subject: rendered.subject, html: rendered.html })
        }
        await logSent(supabase, 'post_wedding_thankyou', evt.id, String(offset))
        stats.sent++
      } catch (e) {
        console.error('[post_wedding_thankyou] failed for event', evt.id, e)
        stats.failed++
      }
    }
  }
  return stats
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ===== Auth gate: allow EITHER the cron secret header OR an authenticated admin =====
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
    const providedSecret = req.headers.get('x-cron-secret') ?? ''
    let authorized = false

    if (cronSecret && providedSecret && providedSecret === cronSecret) {
      authorized = true
    } else {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        const { data: userData } = await supabase.auth.getUser(token)
        const caller = userData?.user
        if (caller) {
          const { data: profile } = await supabase
            .from('users').select('role').eq('id', caller.id).single()
          if (profile?.role === 'admin') authorized = true
        }
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }


    const { data: configs, error } = await supabase
      .from('scheduled_emails')
      .select('*')
    if (error) throw error

    const summary: Record<string, PerKeyCount & { enabled: boolean }> = {}

    for (const cfg of configs || []) {
      if (!cfg.enabled) {
        summary[cfg.key] = { sent: 0, skipped: 0, failed: 0, enabled: false }
        continue
      }
      let res: PerKeyCount = { sent: 0, skipped: 0, failed: 0 }
      try {
        if (cfg.key === 'payment_reminder') {
          res = await runPaymentReminder(supabase, cfg.offset_days as number[])
        } else if (cfg.key === 'wedding_countdown') {
          res = await runWeddingCountdown(supabase, cfg.offset_days as number[])
        } else if (cfg.key === 'post_wedding_thankyou') {
          res = await runPostWeddingThankYou(supabase, cfg.offset_days as number[])
        } else {
          console.warn('[run-scheduled-emails] no handler for key', cfg.key)
        }
      } catch (e) {
        console.error('[run-scheduled-emails] handler failed for', cfg.key, e)
      }
      summary[cfg.key] = { ...res, enabled: true }
    }

    return new Response(
      JSON.stringify({ ok: true, ran_at: new Date().toISOString(), summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('run-scheduled-emails error', err)
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

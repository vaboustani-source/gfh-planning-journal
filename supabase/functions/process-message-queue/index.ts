import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PORTAL_BASE = 'https://gilbertsvillefarmhouse.com'

interface QueuedMessage {
  sender_name: string
  body: string
  sent_at: string
}

function formatPartnerLabel(p1: string, p2: string | null): string {
  return p2 && p2.trim() ? `${p1} & ${p2}` : p1
}

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBD'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildAdminSubject(partnerLabel: string, weddingDate: string | null): string {
  if (!weddingDate) {
    return `[GFH] ${partnerLabel} — planning phase`
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const wd = new Date(weddingDate + 'T12:00:00')
  wd.setHours(0, 0, 0, 0)
  const days = Math.floor((wd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (days < 0) return `[GFH] ${partnerLabel} — post-event`
  if (days <= 7) return `🔴 [GFH] ${partnerLabel} — ${days} days out`
  if (days <= 30) return `🟡 [GFH] ${partnerLabel} — ${days} days out`
  if (days <= 90) return `[GFH] ${partnerLabel} — ${days} days out`
  return `[GFH] ${partnerLabel} — planning phase`
}

function daysUntil(weddingDate: string | null): number | null {
  if (!weddingDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const wd = new Date(weddingDate + 'T12:00:00')
  wd.setHours(0, 0, 0, 0)
  return Math.floor((wd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function buildAdminHtml(opts: {
  partnerLabel: string
  eventDateFormatted: string
  daysOut: number | null
  messages: QueuedMessage[]
  portalUrl: string
}): string {
  const { partnerLabel, eventDateFormatted, daysOut, messages, portalUrl } = opts
  const subline = daysOut === null
    ? eventDateFormatted
    : daysOut < 0
      ? `${eventDateFormatted} · post-event`
      : `${eventDateFormatted} · ${daysOut} days out`

  const messageBlocks = messages.map(m => `
    <div style="padding: 12px 14px; margin-bottom: 8px; background: #f7f5f0; border-left: 3px solid #8B9D77; border-radius: 6px;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #8B9D77; font-weight: 600;">${escapeHtml(m.sender_name)} · ${formatMessageTime(m.sent_at)}</p>
      <p style="margin: 0; font-size: 14px; color: #2d2d2d; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(m.body)}</p>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border:1px solid #e8e4de;border-radius:12px;padding:28px;">
      <p style="margin:0 0 16px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8B9D77;font-weight:600;">Gilbertsville Farmhouse — Planning Hub</p>
      <h2 style="margin:0 0 4px 0;font-size:20px;font-weight:500;color:#2d2d2d;">${escapeHtml(partnerLabel)}</h2>
      <p style="margin:0 0 20px 0;font-size:13px;color:#888;">${escapeHtml(subline)}</p>
      ${messageBlocks}
      <div style="text-align:center;margin-top:24px;">
        <a href="${portalUrl}" style="display:inline-block;background:#8B9D77;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:500;">Open Thread</a>
      </div>
    </div>
  </div>
</body></html>`
}

function buildCoupleHtml(opts: {
  messages: QueuedMessage[]
  portalUrl: string
}): string {
  const { messages, portalUrl } = opts
  const messageBlocks = messages.map(m => `
    <div style="padding:14px 16px;margin-bottom:10px;background:#f7f5f0;border-radius:8px;">
      <p style="margin:0 0 6px 0;font-size:15px;color:#2d2d2d;line-height:1.55;font-style:italic;white-space:pre-wrap;">"${escapeHtml(m.body)}"</p>
      <p style="margin:0;font-size:12px;color:#8B9D77;">Brandon · ${formatMessageTime(m.sent_at)}</p>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px;">
    <div style="background:#fff;border:1px solid #e8e4de;border-radius:12px;padding:32px;text-align:center;">
      <p style="margin:0 0 24px 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8B9D77;font-weight:600;">Gilbertsville Farmhouse</p>
      <h2 style="margin:0 0 24px 0;font-size:22px;font-weight:300;color:#2d2d2d;">A note from Brandon.</h2>
      <div style="text-align:left;">${messageBlocks}</div>
      <p style="margin:24px 0 20px 0;font-size:13px;color:#666;line-height:1.5;">Reply in your Planning Hub — we will see it and respond.</p>
      <a href="${portalUrl}" style="display:inline-block;background:#8B9D77;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">Open the Planning Hub</a>
      <p style="margin:28px 0 0 0;font-size:11px;color:#bbb;letter-spacing:0.08em;">Gilbertsville Farmhouse</p>
    </div>
  </div>
</body></html>`
}

/**
 * Determine if an error from Resend (or send pipeline) is permanent (don't retry)
 * versus transient (retry with backoff).
 */
function isPermanentFailure(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (msg.includes('422')) return true
  if (msg.includes('invalid')) return true
  if (msg.includes('not a valid email')) return true
  if (msg.includes('bounced')) return true
  if (msg.includes('suppressed')) return true
  return false
}

/** Backoff schedule in minutes, indexed by attempts count. */
function backoffMinutes(attempts: number): number | null {
  if (attempts === 1) return 5
  if (attempts === 2) return 30
  if (attempts === 3) return 120
  return null // >=4 → permanent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const nowIso = new Date().toISOString()

    const { data: pendingRows, error: fetchErr } = await supabase
      .from('message_notification_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('scheduled_send_at', nowIso)
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order('created_at', { ascending: true })

    if (fetchErr) throw fetchErr
    if (!pendingRows || pendingRows.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let processed = 0
    let failed = 0
    let permanentlyFailed = 0

    for (const row of pendingRows) {
      const newAttempts = (row.attempts ?? 0) + 1

      try {
        // Increment attempts BEFORE attempting send
        await supabase
          .from('message_notification_queue')
          .update({ attempts: newAttempts })
          .eq('id', row.id)

        // Fetch event metadata (partner names + wedding date)
        const { data: evt } = await supabase
          .from('events')
          .select('title, wedding_date, partner1_name, partner2_name')
          .eq('id', row.event_id)
          .single()

        const p1 = (evt?.partner1_name?.trim()) || evt?.title || 'Wedding'
        const p2 = evt?.partner2_name?.trim() || null
        const weddingDate: string | null = evt?.wedding_date ?? null
        const partnerLabel = formatPartnerLabel(p1, p2)
        const eventDateFormatted = formatEventDate(weddingDate)
        const daysOut = daysUntil(weddingDate)

        const messages = (row.messages_json as QueuedMessage[]) || []
        if (messages.length === 0) {
          // Nothing to send; mark sent so it isn't retried
          await supabase
            .from('message_notification_queue')
            .update({ status: 'sent', sent: true })
            .eq('id', row.id)
          continue
        }

        let subject: string
        let html: string

        if (row.recipient_role === 'admin') {
          subject = buildAdminSubject(partnerLabel, weddingDate)
          html = buildAdminHtml({
            partnerLabel,
            eventDateFormatted,
            daysOut,
            messages,
            portalUrl: `${PORTAL_BASE}/admin`,
          })
        } else {
          subject = messages.length === 1
            ? 'A note from Brandon at Gilbertsville'
            : `${messages.length} new notes from Brandon at Gilbertsville`
          html = buildCoupleHtml({
            messages,
            portalUrl: `${PORTAL_BASE}/portal/messages`,
          })
        }

        await sendEmail({
          to: row.recipient_email,
          subject,
          html,
        })

        await supabase
          .from('message_notification_queue')
          .update({ status: 'sent', sent: true, last_error: null, next_retry_at: null })
          .eq('id', row.id)

        processed++
      } catch (rowErr: any) {
        const errMsg = rowErr?.message ?? String(rowErr)
        const permanent = isPermanentFailure(rowErr)

        try {
          if (permanent) {
            permanentlyFailed++
            console.error('[process-message-queue] Permanent failure', {
              queue_id: row.id,
              event_id: row.event_id,
              recipient: row.recipient_email,
              error: errMsg,
              attempts: newAttempts,
            })
            await supabase
              .from('message_notification_queue')
              .update({
                status: 'permanent_failure',
                sent: true,
                last_error: errMsg,
              })
              .eq('id', row.id)
          } else {
            const backoff = backoffMinutes(newAttempts)
            if (backoff === null) {
              // Exceeded max retry attempts
              permanentlyFailed++
              const finalMsg = `Max retry attempts exceeded: ${errMsg}`
              console.error('[process-message-queue] Max retries exceeded', {
                queue_id: row.id,
                event_id: row.event_id,
                recipient: row.recipient_email,
                error: finalMsg,
                attempts: newAttempts,
              })
              await supabase
                .from('message_notification_queue')
                .update({
                  status: 'permanent_failure',
                  sent: true,
                  last_error: finalMsg,
                })
                .eq('id', row.id)
            } else {
              failed++
              const nextRetry = new Date(Date.now() + backoff * 60 * 1000).toISOString()
              console.warn('[process-message-queue] Transient failure, will retry', {
                queue_id: row.id,
                event_id: row.event_id,
                recipient: row.recipient_email,
                error: errMsg,
                attempts: newAttempts,
                next_retry_at: nextRetry,
              })
              await supabase
                .from('message_notification_queue')
                .update({
                  status: 'failed',
                  last_error: errMsg,
                  next_retry_at: nextRetry,
                })
                .eq('id', row.id)
            }
          }
        } catch (updateErr) {
          console.error('[process-message-queue] Failed to update row status', {
            queue_id: row.id,
            error: updateErr instanceof Error ? updateErr.message : String(updateErr),
          })
        }
        continue
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, permanentlyFailed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('process-message-queue error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { APP_BASE_URL } from '../_shared/appUrls.ts'
import { renderTemplate } from '../_shared/email-shell.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PORTAL_BASE = APP_BASE_URL

// Per-event reply address so couples can reply to notification emails and have it thread back in-app.
const INBOUND_REPLY_ADDRESS = Deno.env.get('INBOUND_REPLY_ADDRESS') // e.g. "reply@reply.gilbertsvillefarmhouse.com"

async function ensureReplyTo(supabase: any, eventId: string): Promise<string | undefined> {
  if (!INBOUND_REPLY_ADDRESS || !INBOUND_REPLY_ADDRESS.includes('@')) return undefined
  const { data: existing } = await supabase
    .from('message_reply_routes')
    .select('token')
    .eq('event_id', eventId)
    .maybeSingle()
  let token: string | undefined = existing?.token
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('message_reply_routes').insert({ token, event_id: eventId })
    if (error) {
      const { data: again } = await supabase
        .from('message_reply_routes')
        .select('token')
        .eq('event_id', eventId)
        .maybeSingle()
      token = again?.token
    }
  }
  if (!token) return undefined
  const [local, domain] = INBOUND_REPLY_ADDRESS.split('@')
  return `${local}+${token}@${domain}`
}

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

function adminStatusParts(weddingDate: string | null): { prefix: string; suffix: string } {
  if (!weddingDate) return { prefix: '', suffix: 'planning phase' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const wd = new Date(weddingDate + 'T12:00:00')
  wd.setHours(0, 0, 0, 0)
  const days = Math.floor((wd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (days < 0) return { prefix: '', suffix: 'post-event' }
  if (days <= 7) return { prefix: '🔴 ', suffix: `${days} days out` }
  if (days <= 30) return { prefix: '🟡 ', suffix: `${days} days out` }
  if (days <= 90) return { prefix: '', suffix: `${days} days out` }
  return { prefix: '', suffix: 'planning phase' }
}

function daysUntil(weddingDate: string | null): number | null {
  if (!weddingDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const wd = new Date(weddingDate + 'T12:00:00')
  wd.setHours(0, 0, 0, 0)
  return Math.floor((wd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function buildAdminMessageBlocks(messages: QueuedMessage[]): string {
  return messages.map(m => `
    <div style="padding: 12px 14px; margin-bottom: 8px; background: #f7f5f0; border-left: 3px solid #8B9D77; border-radius: 6px;">
      <p style="margin: 0 0 4px 0; font-family:Helvetica,Arial,sans-serif;font-size: 12px; color: #8B9D77; font-weight: 600;">${escapeHtml(m.sender_name)} · ${formatMessageTime(m.sent_at)}</p>
      <p style="margin: 0; font-family:Helvetica,Arial,sans-serif;font-size: 14px; color: #2d2d2d; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(m.body)}</p>
    </div>
  `).join('')
}

function buildCoupleMessageBlocks(messages: QueuedMessage[]): string {
  return messages.map(m => `
    <div style="padding:14px 16px;margin-bottom:10px;background:#f7f5f0;border-radius:8px;">
      <p style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#2d2d2d;line-height:1.55;font-style:italic;white-space:pre-wrap;">"${escapeHtml(m.body)}"</p>
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8B9D77;">Brandon · ${formatMessageTime(m.sent_at)}</p>
    </div>
  `).join('')
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
        let replyTo: string | undefined

        if (row.recipient_role === 'admin') {
          const { prefix, suffix } = adminStatusParts(weddingDate)
          const subline = daysOut === null
            ? eventDateFormatted
            : daysOut < 0
              ? `${eventDateFormatted} · post-event`
              : `${eventDateFormatted} · ${daysOut} days out`
          const rendered = await renderTemplate('notify_admin_messages', {
            variables: {
              status_prefix: prefix,
              partner_label: partnerLabel,
              status_suffix: suffix,
              subline,
            },
            contentHtml: buildAdminMessageBlocks(messages),
            ctaUrl: `${PORTAL_BASE}/admin`,
          })
          subject = rendered.subject
          html = rendered.html
        } else {
          const key = messages.length === 1 ? 'notify_couple_message' : 'notify_couple_messages_batch'
          const rendered = await renderTemplate(key, {
            variables: { count: String(messages.length) },
            contentHtml: buildCoupleMessageBlocks(messages),
            ctaUrl: `${PORTAL_BASE}/portal/messages`,
          })
          subject = rendered.subject
          html = rendered.html
          replyTo = await ensureReplyTo(supabase, row.event_id)
        }

        await sendEmail({
          to: row.recipient_email,
          subject,
          html,
          replyTo,
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

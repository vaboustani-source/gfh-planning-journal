// Sales manager (or admin) marks an event as ready to hand off to the event
// director. Sets lifecycle_stage='handed_off' and emails every active
// event_director / admin user. May be triggered multiple times — each call
// refreshes handed_off_at and re-sends the notification.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { APP_BASE_URL } from '../_shared/appUrls.ts'
import { renderTemplate } from '../_shared/email-shell.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const auth = req.headers.get('Authorization') ?? ''
    let caller: any = null
    if (auth) {
      const { data } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
      caller = data?.user ?? null
    }
    if (!caller) throw new Error('Not authenticated')

    const { event_id } = await req.json()
    if (!event_id) throw new Error('event_id is required')

    // Caller must be admin or sales_manager
    const { data: callerProfile } = await supabase
      .from('users').select('role, first_name, last_name').eq('id', caller.id).single()
    const allowed = ['admin', 'sales_manager', 'event_director'].includes(callerProfile?.role ?? '')
    if (!allowed) throw new Error('Not authorized to hand off events')

    const { data: event, error: evErr } = await supabase
      .from('events')
      .update({
        lifecycle_stage: 'handed_off',
        handed_off_at: new Date().toISOString(),
        handed_off_by: caller.id,
      })
      .eq('id', event_id)
      .select()
      .single()
    if (evErr) throw evErr

    // Recipients: event_director + admin
    const { data: directors } = await supabase
      .from('users')
      .select('email, first_name')
      .in('role', ['event_director', 'admin'])

    const handlerName = [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(' ') || 'Sales'
    const link = `${APP_BASE_URL}/admin/events/${event.id}`
    const wd = event.wedding_date ? new Date(event.wedding_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date TBD'
    function escapeHtml(s: string): string {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    }
    const detailsHtml = `
        <table cellspacing="0" cellpadding="0" style="width:100%;background:#F7F5EF;border:1px solid #E8E2D9;border-radius:8px;margin:8px 0 8px;">
          <tr><td style="padding:18px 22px;">
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a8478;letter-spacing:0.06em;text-transform:uppercase;">Couple</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#2C3E2D;margin-bottom:10px;">${escapeHtml(event.title ?? '')}</div>
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a8478;letter-spacing:0.06em;text-transform:uppercase;">Wedding Date</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#2C3E2D;margin-bottom:10px;">${escapeHtml(wd)}</div>
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a8478;letter-spacing:0.06em;text-transform:uppercase;">Package</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#2C3E2D;text-transform:capitalize;">${escapeHtml(String(event.package_tier ?? 'base'))}</div>
          </td></tr>
        </table>`

    const { subject, html } = await renderTemplate('event_handoff_notice', {
      variables: {
        event_title: event.title ?? '',
        handler_name: handlerName,
      },
      contentHtml: detailsHtml,
      ctaUrl: link,
    })

    const recipients = (directors ?? []).map(d => d.email).filter(Boolean) as string[]
    let emailDelivery: { sent: number; failed: number; reason?: string } = { sent: 0, failed: 0 }
    for (const to of recipients) {
      try { await sendEmail({ to, subject, html }); emailDelivery.sent++ }
      catch (e: any) { emailDelivery.failed++; emailDelivery.reason = e?.message }
    }

    // In-app notification log entries (one per director)
    if (recipients.length > 0) {
      const { data: dirUsers } = await supabase
        .from('users').select('id, email').in('role', ['event_director', 'admin'])
      const rows = (dirUsers ?? []).map(u => ({
        event_id: event.id,
        user_id: u.id,
        notification_type: 'handoff_ready',
        subject_line: subject,
      }))
      if (rows.length) await supabase.from('notification_log').insert(rows)
    }

    return new Response(
      JSON.stringify({ success: true, event, emailDelivery, recipientCount: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('mark-event-handoff error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

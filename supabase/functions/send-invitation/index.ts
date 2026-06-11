import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { APP_BASE_URL } from '../_shared/appUrls.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  invite_type: 'staff' | 'couple' | 'participant'
  email: string
  invited_name?: string
  assigned_role?: string         // staff
  event_id?: string              // couple, participant
  role_in_event?: string         // participant
  access_tier?: number           // participant
  tab_access?: Record<string, boolean> // participant
  // resend an existing invitation by id
  resend_id?: string
}

function buildEmail(opts: {
  type: 'staff' | 'couple' | 'participant'
  link: string
  invitedName?: string
  inviterName?: string
  eventTitle?: string
}) {
  const greeting = opts.invitedName ? `Hello ${opts.invitedName},` : 'Hello,'
  let subject = ''
  let intro = ''
  let context = ''
  if (opts.type === 'staff') {
    subject = "You've been invited to the Gilbertsville Farmhouse team"
    intro = 'Welcome.'
    context = `You have been invited to join the Gilbertsville Farmhouse Planning Journal team. When you set up your access, you will be able to sign in and begin working alongside us right away.`
  } else if (opts.type === 'couple') {
    subject = 'Your wedding planning portal is ready'
    intro = 'Welcome.'
    context = `Your private planning portal at Gilbertsville Farmhouse is ready for you. Once you set up your access, you will land directly inside your wedding portal where everything for your weekend lives in one calm place.`
  } else {
    subject = `${opts.inviterName ?? 'Brandon'} has added you to ${opts.eventTitle ?? 'an upcoming wedding'}`
    intro = 'Welcome.'
    context = `You have been invited to help with ${opts.eventTitle ?? 'an upcoming wedding'} at Gilbertsville Farmhouse. Setting up your access takes about a minute, then you will land directly inside the parts of the portal that are yours to help with.`
  }

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,'Times New Roman',serif;color:#2C3E2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F4;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #E8E2D9;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:36px 40px 8px;text-align:center;border-bottom:1px solid #F0EDE6;">
          <div style="font-size:22px;letter-spacing:0.06em;color:#2C3E2D;font-weight:300;">Gilbertsville Farmhouse</div>
          <div style="font-size:13px;color:#7a8478;font-style:italic;margin-top:4px;">Planning Journal</div>
        </td></tr>
        <tr><td style="padding:32px 40px 8px;">
          <h1 style="font-size:26px;font-weight:300;color:#2C3E2D;margin:0 0 14px;letter-spacing:0.02em;">${intro}</h1>
          <p style="font-size:15px;line-height:1.7;color:#55615a;margin:0 0 8px;">${greeting}</p>
          <p style="font-size:15px;line-height:1.7;color:#55615a;margin:0 0 28px;">${context}</p>
          <div style="text-align:center;margin:8px 0 12px;">
            <a href="${opts.link}" style="display:inline-block;background:#5b6f56;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:6px;font-size:14px;letter-spacing:0.06em;">Set Up Your Access</a>
          </div>
          <p style="font-size:12px;line-height:1.6;color:#9aa097;margin:24px 0 0;text-align:center;">This invitation expires in 14 days. If you were not expecting this, you can disregard it.</p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;text-align:center;border-top:1px solid #F0EDE6;">
          <div style="font-size:11px;color:#9aa097;letter-spacing:0.08em;">GILBERTSVILLE FARMHOUSE</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const callerToken = authHeader.replace('Bearer ', '')
    let invited_by: string | null = null
    let callerRole: string | null = null
    if (callerToken) {
      const { data: u } = await supabase.auth.getUser(callerToken)
      invited_by = u?.user?.id ?? null
      if (invited_by) {
        const { data: row } = await supabase.from('users').select('role').eq('id', invited_by).maybeSingle()
        callerRole = row?.role ?? null
      }
    }

    const body = (await req.json()) as Body

    // Authorize caller. Admin/event_director may invite anyone. Other authenticated users
    // may only invite participants to events they themselves are members of, and the
    // access tier they hand out is clamped to 3 (Full Couple) so they cannot escalate
    // anyone to Admin Light.
    const isStaff = callerRole === 'admin' || callerRole === 'event_director'
    if (!isStaff) {
      if (!invited_by) throw new Error('Not authenticated')
      if (body.resend_id) {
        const { data: existingInv } = await supabase
          .from('invitations').select('event_id, invite_type').eq('id', body.resend_id).maybeSingle()
        if (!existingInv) throw new Error('Invitation not found')
        if (existingInv.invite_type !== 'participant' || !existingInv.event_id) throw new Error('Not allowed')
        const { data: memberRow } = await supabase
          .from('event_users').select('user_id').eq('event_id', existingInv.event_id).eq('user_id', invited_by).maybeSingle()
        if (!memberRow) throw new Error('Not allowed')
      } else {
        if (body.invite_type !== 'participant') throw new Error('Not allowed')
        if (!body.event_id) throw new Error('event_id required')
        const { data: memberRow } = await supabase
          .from('event_users').select('user_id').eq('event_id', body.event_id).eq('user_id', invited_by).maybeSingle()
        if (!memberRow) throw new Error('Not allowed')
        if (typeof body.access_tier === 'number' && body.access_tier > 3) body.access_tier = 3
      }
    }


    let invitation: any
    let eventTitle: string | undefined

    if (body.resend_id) {
      const { data: existing, error: getErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', body.resend_id)
        .single()
      if (getErr || !existing) throw new Error('Invitation not found')
      if (existing.status === 'accepted') throw new Error('This invitation has already been accepted')
      const { data: updated, error: updErr } = await supabase
        .from('invitations')
        .update({
          status: 'pending',
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (updErr) throw updErr
      invitation = updated
    } else {
      if (!body.email || !body.invite_type) throw new Error('email and invite_type are required')
      const email = body.email.trim().toLowerCase()

      // Revoke any prior pending invites for same email+context
      await supabase
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('email', email)
        .eq('status', 'pending')
        .eq('invite_type', body.invite_type)
        .filter('event_id', body.event_id ? 'eq' : 'is', body.event_id ?? null)

      const { data: created, error: insErr } = await supabase
        .from('invitations')
        .insert({
          email,
          invite_type: body.invite_type,
          assigned_role: body.assigned_role ?? null,
          event_id: body.event_id ?? null,
          tab_access: body.tab_access ?? null,
          role_in_event: body.role_in_event ?? null,
          access_tier: body.access_tier ?? null,
          invited_by,
          invited_name: body.invited_name ?? null,
        })
        .select()
        .single()
      if (insErr) throw insErr
      invitation = created
    }

    if (invitation.event_id) {
      const { data: ev } = await supabase
        .from('events')
        .select('title')
        .eq('id', invitation.event_id)
        .single()
      eventTitle = ev?.title
    }

    let inviterName: string | undefined
    if (invitation.invited_by) {
      const { data: inviter } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', invitation.invited_by)
        .single()
      if (inviter) inviterName = [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || undefined
    }

    const link = `${APP_BASE_URL}/accept-invite/${invitation.token}`
    const { subject, html } = buildEmail({
      type: invitation.invite_type,
      link,
      invitedName: invitation.invited_name ?? undefined,
      inviterName,
      eventTitle,
    })

    let emailDelivery: { sent: boolean; reason?: string } = { sent: false }
    try {
      await sendEmail({ to: invitation.email, subject, html })
      emailDelivery = { sent: true }
    } catch (e: any) {
      console.error('send-invitation email failed:', e?.message ?? e)
      emailDelivery = { sent: false, reason: e?.message ?? 'Email send failed' }
    }

    return new Response(
      JSON.stringify({ success: true, invitation, link, emailDelivery }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('send-invitation error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

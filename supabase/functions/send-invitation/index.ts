import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { APP_BASE_URL } from '../_shared/appUrls.ts'
import { renderTemplate } from '../_shared/email-shell.ts'

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

async function buildEmail(opts: {
  type: 'staff' | 'couple' | 'participant'
  link: string
  invitedName?: string
  inviterName?: string
  eventTitle?: string
}) {
  const greeting = opts.invitedName ? `Hello ${opts.invitedName},` : 'Hello,'
  const key =
    opts.type === 'staff' ? 'invitation_staff'
    : opts.type === 'couple' ? 'invitation_couple'
    : 'invitation_participant'

  return await renderTemplate(key, {
    variables: {
      greeting,
      invited_name: opts.invitedName ?? '',
      inviter_name: opts.inviterName ?? 'Brandon',
      event_title: opts.eventTitle ?? 'an upcoming wedding',
      link: opts.link,
    },
    ctaUrl: opts.link,
  })
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

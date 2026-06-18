// Event director (or admin) clicks "Open Portal for Client" — this is the
// moment the couple receives their invitation email. Issues two couple
// invitations through the unified send-invitation flow using the partner
// info stashed at event creation, and flips lifecycle_stage='portal_open'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { data: callerProfile } = await supabase
      .from('users').select('role').eq('id', caller.id).single()
    if (!['admin', 'event_director'].includes(callerProfile?.role ?? '')) {
      throw new Error('Only admins or event directors may open the portal for a client')
    }

    const body = await req.json()
    const event_id: string = body.event_id
    if (!event_id) throw new Error('event_id is required')

    // Allow caller to override partner emails if missing
    const overrideP1Email: string | undefined = body.partner1_email
    const overrideP2Email: string | undefined = body.partner2_email

    const { data: event, error: evErr } = await supabase
      .from('events').select('*').eq('id', event_id).single()
    if (evErr || !event) throw new Error('Event not found')

    const p1Email = (overrideP1Email || event.pending_partner1_email || '').toLowerCase().trim()
    const p2Email = (overrideP2Email || event.pending_partner2_email || '').toLowerCase().trim()
    if (!p1Email) throw new Error('Partner one email is required to open the portal')
    if (p2Email && p1Email === p2Email) throw new Error('Partners must have different email addresses')

    const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-invitation`
    const inviteHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      Authorization: auth,
    }

    const invitePartner = async (email: string, invitedName: string | null, role_in_event: 'partner_1' | 'partner_2') => {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: inviteHeaders,
        body: JSON.stringify({
          invite_type: 'couple',
          email,
          invited_name: invitedName,
          event_id,
          role_in_event,
          access_tier: 3,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.error) throw new Error(json?.error || `Failed to invite ${email}`)
      return json
    }

    const inv1 = await invitePartner(p1Email, event.pending_partner1_name ?? event.partner1_name, 'partner_1')
    const inv2 = p2Email
      ? await invitePartner(p2Email, event.pending_partner2_name ?? event.partner2_name, 'partner_2')
      : null

    const { error: updErr } = await supabase
      .from('events')
      .update({
        lifecycle_stage: 'portal_open',
        portal_opened_at: new Date().toISOString(),
        portal_opened_by: caller.id,
      })
      .eq('id', event_id)
    if (updErr) throw updErr

    return new Response(
      JSON.stringify({
        success: true,
        invitations: [inv1?.invitation, inv2?.invitation ?? null].filter(Boolean),
        emailDelivery: { partner1: inv1?.emailDelivery, partner2: inv2?.emailDelivery ?? null },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('open-client-portal error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

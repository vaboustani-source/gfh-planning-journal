// Creates a wedding event, seeds it, and sends invitation tokens to both
// partners through the unified send-invitation flow. Replaces the old
// create-couple-accounts function. No partner auth account is pre-created —
// the couple lands on /accept-invite/:token like every other invitee.
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

    const authHeader = req.headers.get('Authorization') ?? ''

    const {
      partner1_first_name, partner1_last_name, partner1_email,
      partner2_first_name, partner2_last_name, partner2_email,
      wedding_date, arrival_date, departure_date, package_tier,
    } = await req.json()

    if (!partner1_email || !partner2_email) {
      throw new Error('Both partner emails are required')
    }
    const p1Email = String(partner1_email).trim().toLowerCase()
    const p2Email = String(partner2_email).trim().toLowerCase()
    if (p1Email === p2Email) throw new Error('Partners must have different email addresses')

    const n1 = [partner1_first_name, partner1_last_name].filter(Boolean).join(' ') || p1Email
    const n2 = [partner2_first_name, partner2_last_name].filter(Boolean).join(' ') || p2Email
    const eventTitle = `${n1} & ${n2}`

    // 1. Create event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: eventTitle,
        wedding_date: wedding_date || null,
        arrival_date: arrival_date || null,
        departure_date: departure_date || null,
        package_tier: package_tier || 'base',
        partner1_name: n1,
        partner2_name: n2,
        status: 'onboarding',
        event_type: 'wedding',
      })
      .select()
      .single()
    if (eventError) throw eventError

    // 2. Seed the usual templates
    const milestoneDate = wedding_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    try {
      await supabase.rpc('seed_milestones', { p_event_id: event.id, p_wedding_date: milestoneDate })
      await supabase.rpc('seed_vendors', { p_event_id: event.id })
      await supabase.rpc('seed_checklist', { p_event_id: event.id })
      await supabase.rpc('seed_planning_timeline', { p_event_id: event.id })
      await supabase.rpc('seed_working_timeline', { p_event_id: event.id })
    } catch (seedErr: any) {
      console.error('seeding error (non-fatal):', seedErr?.message ?? seedErr)
    }

    // 3. Issue two couple invitations via the unified flow.
    const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-invitation`
    const inviteHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    }
    if (authHeader) inviteHeaders['Authorization'] = authHeader

    const invitePartner = async (
      email: string,
      first: string,
      last: string,
      role_in_event: 'partner_1' | 'partner_2',
    ) => {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: inviteHeaders,
        body: JSON.stringify({
          invite_type: 'couple',
          email,
          invited_name: [first, last].filter(Boolean).join(' ') || null,
          event_id: event.id,
          role_in_event,
          access_tier: 3,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.error) {
        throw new Error(json?.error || `Failed to invite ${email}`)
      }
      return json
    }

    const inv1 = await invitePartner(p1Email, partner1_first_name || '', partner1_last_name || '', 'partner_1')
    const inv2 = await invitePartner(p2Email, partner2_first_name || '', partner2_last_name || '', 'partner_2')

    return new Response(
      JSON.stringify({
        event_id: event.id,
        event_title: eventTitle,
        invitations: [inv1?.invitation, inv2?.invitation],
        emailDelivery: { partner1: inv1?.emailDelivery, partner2: inv2?.emailDelivery },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('create-event-and-invite-couple error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

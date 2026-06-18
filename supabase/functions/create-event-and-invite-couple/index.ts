// Creates a wedding event and seeds it. **Does NOT invite the couple.**
// The couple invitation is now deferred until the event director explicitly
// clicks "Open Portal for Client" (see open-client-portal). Partner contact
// info is stashed on the event row so we can invite later.
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
    let createdBy: string | null = null
    if (authHeader) {
      const { data: u } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      createdBy = u?.user?.id ?? null
    }

    const {
      partner1_first_name, partner1_last_name, partner1_email,
      partner2_first_name, partner2_last_name, partner2_email,
      wedding_date, arrival_date, departure_date, package_tier,
    } = await req.json()

    if (!partner1_email) {
      throw new Error("Partner one's email is required")
    }
    const p1Email = String(partner1_email).trim().toLowerCase()
    const p2Email = partner2_email ? String(partner2_email).trim().toLowerCase() : null
    if (p2Email && p1Email === p2Email) throw new Error('Partners must have different email addresses')

    const n1 = [partner1_first_name, partner1_last_name].filter(Boolean).join(' ') || p1Email
    const n2Raw = [partner2_first_name, partner2_last_name].filter(Boolean).join(' ')
    const n2 = n2Raw || p2Email || null
    const eventTitle = n2 ? `${n1} & ${n2}` : n1

    // Create event in sales_setup stage. Couple receives NO email yet.
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
        lifecycle_stage: 'sales_setup',
        pending_partner1_email: p1Email,
        pending_partner1_name: n1,
        pending_partner2_email: p2Email,
        pending_partner2_name: n2,
        created_by: createdBy,
      })
      .select()
      .single()
    if (eventError) throw eventError

    // Seed the usual templates
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

    return new Response(
      JSON.stringify({
        event_id: event.id,
        event_title: eventTitle,
        lifecycle_stage: 'sales_setup',
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

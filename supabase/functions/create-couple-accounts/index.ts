import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const {
      partner1_first_name, partner1_last_name, partner1_email,
      partner2_first_name, partner2_last_name, partner2_email,
      wedding_date, arrival_date, departure_date, package_tier,
    } = await req.json()

    if (!partner1_email || !partner2_email) {
      throw new Error('Both partner emails are required')
    }

    const n1 = [partner1_first_name, partner1_last_name].filter(Boolean).join(' ') || partner1_email
    const n2 = [partner2_first_name, partner2_last_name].filter(Boolean).join(' ') || partner2_email
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
        status: 'onboarding',
        event_type: 'wedding',
      })
      .select()
      .single()

    if (eventError) throw eventError

    const rollbackEvent = async () => {
      await supabase.from('events').delete().eq('id', event.id)
    }

    // 2. Get or create partner accounts
    const getOrCreateUser = async (email: string, firstName: string, lastName: string) => {
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find(u => u.email === email)
      if (existing) return existing

      const tempPassword = crypto.randomUUID() + '-Aa1!'
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      })
      if (error) throw error
      return data.user
    }

    let user1, user2
    try {
      user1 = await getOrCreateUser(partner1_email, partner1_first_name || '', partner1_last_name || '')
      user2 = await getOrCreateUser(partner2_email, partner2_first_name || '', partner2_last_name || '')
    } catch (inviteErr) {
      await rollbackEvent()
      throw inviteErr
    }

    if (!user1 || !user2) {
      await rollbackEvent()
      throw new Error('Failed to create partner accounts')
    }

    // 3. Upsert public users
    const { error: upsertErr } = await supabase.from('users').upsert([
      {
        id: user1.id,
        email: partner1_email,
        first_name: partner1_first_name || null,
        last_name: partner1_last_name || null,
        role: 'couple',
      },
      {
        id: user2.id,
        email: partner2_email,
        first_name: partner2_first_name || null,
        last_name: partner2_last_name || null,
        role: 'couple',
      },
    ], { onConflict: 'id' })

    if (upsertErr) {
      await rollbackEvent()
      throw upsertErr
    }

    // 4. Link to event
    const { error: linkErr } = await supabase.from('event_users').insert([
      { event_id: event.id, user_id: user1.id, role_in_event: 'partner_1' },
      { event_id: event.id, user_id: user2.id, role_in_event: 'partner_2' },
    ])

    if (linkErr) {
      await rollbackEvent()
      throw linkErr
    }

    // 5. Seed milestones and vendors
    // Use wedding_date if provided, otherwise fallback to today + 365 days
    const milestoneDate = wedding_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    await supabase.rpc('seed_milestones', { p_event_id: event.id, p_wedding_date: milestoneDate })
    await supabase.rpc('seed_vendors', { p_event_id: event.id })
    await supabase.rpc('seed_checklist', { p_event_id: event.id })
    await supabase.rpc('seed_planning_timeline', { p_event_id: event.id })

    return new Response(
      JSON.stringify({ event_id: event.id, event_title: eventTitle }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('create-couple-accounts error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

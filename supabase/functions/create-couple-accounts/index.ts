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

    // Build event title
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

    // 2. Invite / get partner accounts
    const invitePartner = async (email: string, firstName: string, lastName: string) => {
      // Try inviting — if user already exists this will error, so we fallback to lookup
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { first_name: firstName, last_name: lastName },
      })
      if (error) {
        // User might already exist — fetch by email
        const { data: list } = await supabase.auth.admin.listUsers()
        const existing = list?.users?.find(u => u.email === email)
        if (existing) return existing
        throw error
      }
      return data.user
    }

    const [user1, user2] = await Promise.all([
      invitePartner(partner1_email, partner1_first_name || '', partner1_last_name || ''),
      invitePartner(partner2_email, partner2_first_name || '', partner2_last_name || ''),
    ])

    if (!user1 || !user2) throw new Error('Failed to create partner accounts')

    // 3. Upsert public users with names + role
    await supabase.from('users').upsert([
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

    // 4. Link to event
    await supabase.from('event_users').insert([
      { event_id: event.id, user_id: user1.id, role_in_event: 'partner_1' },
      { event_id: event.id, user_id: user2.id, role_in_event: 'partner_2' },
    ])

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

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

    const { event_id, first_name, last_name, email, role_in_event, access_tier } = await req.json()

    if (!event_id || !email) {
      throw new Error('event_id and email are required')
    }

    // 1. Get or create user in auth
    const { data: list } = await supabase.auth.admin.listUsers()
    let authUser = list?.users?.find(u => u.email === email)

    if (!authUser) {
      const tempPassword = crypto.randomUUID() + '-Aa1!'
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { first_name: first_name || '', last_name: last_name || '' },
      })
      if (error) throw error
      authUser = data.user
    }

    if (!authUser) throw new Error('Failed to create user account')

    // 2. Upsert public users row
    await supabase.from('users').upsert({
      id: authUser.id,
      email,
      first_name: first_name || null,
      last_name: last_name || null,
      role: 'couple',
    }, { onConflict: 'id' })

    // 3. Check if already linked to this event
    const { data: existing } = await supabase
      .from('event_users')
      .select('id')
      .eq('event_id', event_id)
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (existing) {
      // Update role and tier
      await supabase.from('event_users')
        .update({ role_in_event, access_tier: access_tier || 3 })
        .eq('id', existing.id)
    } else {
      // Insert new link
      const { error: linkErr } = await supabase.from('event_users').insert({
        event_id,
        user_id: authUser.id,
        role_in_event,
        access_tier: access_tier || 3,
      })
      if (linkErr) throw linkErr
    }

    return new Response(
      JSON.stringify({ success: true, user_id: authUser.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('invite-participant error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

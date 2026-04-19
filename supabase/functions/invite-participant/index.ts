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

    const { event_id, first_name, last_name, email, role_in_event, access_tier, redirect_to } =
      await req.json()

    if (!event_id || !email) {
      throw new Error('event_id and email are required')
    }

    // The page where the user lands to set their password after clicking the email link.
    // The frontend passes the current origin so this works in dev/preview/prod.
    const setPasswordRedirect = redirect_to || 'https://plan.gilbertsvillefarmhouse.com/set-password'

    // 1. Get or invite user in auth
    const { data: list } = await supabase.auth.admin.listUsers()
    let authUser = list?.users?.find(u => u.email === email)
    let invited = false

    if (!authUser) {
      // New user — send an invite email (this delivers a magic link to set password)
      const { data: invData, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { first_name: first_name || '', last_name: last_name || '' },
        redirectTo: setPasswordRedirect,
      })
      if (invErr) throw invErr
      authUser = invData.user
      invited = true
    } else {
      // Existing user — send them a fresh password-recovery link so they can (re)set their password
      // and immediately access this event's portal.
      const { error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: setPasswordRedirect },
      })
      if (linkErr) {
        // Non-fatal: the user already exists and can sign in normally. Log and continue.
        console.warn('generateLink (recovery) failed for existing user:', linkErr.message)
      }
    }

    if (!authUser) throw new Error('Failed to create or look up user account')

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
      await supabase.from('event_users')
        .update({ role_in_event, access_tier: access_tier || 3 })
        .eq('id', existing.id)
    } else {
      const { error: linkErr } = await supabase.from('event_users').insert({
        event_id,
        user_id: authUser.id,
        role_in_event,
        access_tier: access_tier || 3,
      })
      if (linkErr) throw linkErr
    }

    return new Response(
      JSON.stringify({ success: true, user_id: authUser.id, invited }),
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

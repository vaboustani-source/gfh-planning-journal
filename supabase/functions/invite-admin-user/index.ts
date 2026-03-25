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

    const { first_name, last_name, email, role } = await req.json()

    if (!email) {
      throw new Error('Email is required')
    }

    const adminRole = role || 'admin'

    // Invite or look up the user
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { first_name: first_name || '', last_name: last_name || '' },
    })

    let userId: string

    if (inviteError) {
      // User may already exist — fall back to listing
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find(u => u.email === email)
      if (existing) {
        userId = existing.id
      } else {
        throw inviteError
      }
    } else {
      userId = inviteData.user.id
    }

    // Upsert into public.users with admin role
    const { error: upsertError } = await supabase.from('users').upsert({
      id: userId,
      email,
      first_name: first_name || null,
      last_name: last_name || null,
      role: adminRole,
    }, { onConflict: 'id' })

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ user_id: userId, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('invite-admin-user error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

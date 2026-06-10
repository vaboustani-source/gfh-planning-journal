import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  token: string
  // For password setup (no session yet)
  password?: string
  first_name?: string
  last_name?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = (await req.json()) as Body
    if (!body.token) throw new Error('Token is required')

    // 1. Look up invitation
    const { data: inv, error: invErr } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', body.token)
      .maybeSingle()
    if (invErr) throw invErr
    if (!inv) throw new Error('This invitation could not be found')
    if (inv.status === 'accepted') throw new Error('This invitation has already been used')
    if (inv.status === 'revoked') throw new Error('This invitation has been revoked')
    if (inv.status === 'expired' || new Date(inv.expires_at) < new Date()) {
      await supabase.from('invitations').update({ status: 'expired' }).eq('id', inv.id)
      throw new Error('This invitation has expired, please contact your coordinator')
    }

    const invitedEmail = inv.email.toLowerCase()

    // 2. Determine the authenticated caller (Google OAuth path), or
    //    create/find account for password path.
    let userId: string | null = null
    let userEmail: string | null = null

    const authHeader = req.headers.get('Authorization') ?? ''
    const callerToken = authHeader.replace('Bearer ', '')

    if (callerToken) {
      const { data: u } = await supabase.auth.getUser(callerToken)
      if (u?.user) {
        userId = u.user.id
        userEmail = (u.user.email ?? '').toLowerCase()
        if (userEmail !== invitedEmail) {
          return new Response(
            JSON.stringify({
              error: `This invitation was sent to ${invitedEmail}, please sign in with that account.`,
              code: 'email_mismatch',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }
    }

    if (!userId) {
      // Password path — need password
      if (!body.password || body.password.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }
      // Look up or create auth user with the invited email
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find((u) => (u.email ?? '').toLowerCase() === invitedEmail)
      if (existing) {
        userId = existing.id
        // Set/update password
        await supabase.auth.admin.updateUserById(existing.id, { password: body.password, email_confirm: true })
      } else {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: invitedEmail,
          password: body.password,
          email_confirm: true,
          user_metadata: { first_name: body.first_name ?? '', last_name: body.last_name ?? '' },
        })
        if (createErr || !created.user) throw createErr ?? new Error('Failed to create account')
        userId = created.user.id
      }
      userEmail = invitedEmail
    }

    // 3. Upsert public.users
    const role = inv.invite_type === 'staff' ? (inv.assigned_role ?? 'planner') : 'couple'
    // Only override role if staff (don't downgrade existing admin to couple if they already exist).
    const { data: existingProfile } = await supabase
      .from('users').select('id, role').eq('id', userId!).maybeSingle()
    if (!existingProfile) {
      await supabase.from('users').insert({
        id: userId!, email: invitedEmail,
        first_name: body.first_name ?? inv.invited_name ?? null,
        last_name: body.last_name ?? null,
        role,
      })
    } else if (inv.invite_type === 'staff' && inv.assigned_role) {
      await supabase.from('users').update({ role: inv.assigned_role }).eq('id', userId!)
    }

    // 4. Apply invite — event linkage
    let landing = '/admin'
    if (inv.invite_type === 'staff') {
      landing = '/admin'
    } else if (inv.invite_type === 'couple' && inv.event_id) {
      await supabase.from('event_users').upsert({
        event_id: inv.event_id,
        user_id: userId!,
        role_in_event: inv.role_in_event ?? 'couple',
        access_tier: inv.access_tier ?? 3,
      }, { onConflict: 'event_id,user_id' })
      landing = '/portal'
    } else if (inv.invite_type === 'participant' && inv.event_id) {
      await supabase.from('event_users').upsert({
        event_id: inv.event_id,
        user_id: userId!,
        role_in_event: inv.role_in_event ?? 'participant',
        access_tier: inv.access_tier ?? 3,
        tab_access: inv.tab_access ?? null,
      }, { onConflict: 'event_id,user_id' })
      landing = `/portal?event=${inv.event_id}`
    }

    // 5. Mark accepted
    await supabase
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', inv.id)

    return new Response(
      JSON.stringify({ success: true, landing, user_id: userId, email: invitedEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('accept-invitation error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

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

    const { event_id, sender_id, message_body } = await req.json()

    if (!event_id || !sender_id || !message_body) {
      throw new Error('event_id, sender_id, and message_body are required')
    }

    // Determine sender role and get event info
    const [senderResult, eventResult, eventUsersResult] = await Promise.all([
      supabase.from('users').select('role, first_name, last_name, email').eq('id', sender_id).single(),
      supabase.from('events').select('title').eq('id', event_id).single(),
      supabase.from('event_users').select('user_id, role_in_event').eq('event_id', event_id),
    ])

    const sender = senderResult.data
    if (!sender) throw new Error('Sender not found')

    const eventTitle = eventResult.data?.title || 'Wedding'
    const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || sender.email
    const isAdmin = sender.role === 'admin'

    // Build recipient list
    const recipients: { email: string; role: string }[] = []

    if (isAdmin) {
      // Admin sent message → notify both partners
      const partnerIds = (eventUsersResult.data || []).map(eu => eu.user_id).filter(Boolean)
      if (partnerIds.length > 0) {
        const { data: partners } = await supabase
          .from('users')
          .select('email')
          .in('id', partnerIds)
        for (const p of partners || []) {
          if (p.email && p.email !== sender.email) {
            recipients.push({ email: p.email, role: 'couple' })
          }
        }
      }
    } else {
      // Couple sent message → notify admin
      recipients.push({ email: 'experience@gilbertsvillefarmhouse.com', role: 'admin' })
    }

    const now = new Date()
    const scheduledAt = new Date(now.getTime() + 10 * 60 * 1000) // now + 10 minutes

    const messageEntry = {
      sender_name: senderName,
      body: message_body,
      sent_at: now.toISOString(),
    }

    // Upsert for each recipient
    for (const recipient of recipients) {
      // Check for existing unsent queue row
      const { data: existing } = await supabase
        .from('message_notification_queue')
        .select('id, messages_json')
        .eq('event_id', event_id)
        .eq('recipient_email', recipient.email)
        .eq('sent', false)
        .maybeSingle()

      if (existing) {
        // Append message and reset timer
        const updatedMessages = [...(existing.messages_json as unknown[]), messageEntry]
        await supabase
          .from('message_notification_queue')
          .update({
            messages_json: updatedMessages,
            scheduled_send_at: scheduledAt.toISOString(),
          })
          .eq('id', existing.id)
      } else {
        // Create new queue row
        await supabase
          .from('message_notification_queue')
          .insert({
            event_id,
            recipient_email: recipient.email,
            recipient_role: recipient.role,
            messages_json: [messageEntry],
            scheduled_send_at: scheduledAt.toISOString(),
          })
      }
    }

    return new Response(
      JSON.stringify({ success: true, recipients: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('enqueue-message-notification error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

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

    // Get all unsent rows where scheduled_send_at is in the past
    const { data: pendingRows, error: fetchErr } = await supabase
      .from('message_notification_queue')
      .select('*')
      .eq('sent', false)
      .lte('scheduled_send_at', new Date().toISOString())
      .order('created_at', { ascending: true })

    if (fetchErr) throw fetchErr
    if (!pendingRows || pendingRows.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let processed = 0

    for (const row of pendingRows) {
      // Get event title for subject line
      const { data: evt } = await supabase
        .from('events')
        .select('title')
        .eq('id', row.event_id)
        .single()

      const eventTitle = evt?.title || 'Wedding'
      const messages = row.messages_json as { sender_name: string; body: string; sent_at: string }[]

      // Determine sender name from first message
      const senderName = messages.length > 0 ? messages[0].sender_name : 'Your planning team'

      // Build email subject
      const subject = `New messages from ${senderName} — ${eventTitle}`

      // Build email HTML
      const portalUrl = row.recipient_role === 'admin'
        ? `https://gilbertsvillefarmhouse.com/admin`
        : `https://gilbertsvillefarmhouse.com/portal/messages`

      const messageListHtml = messages.map(m => {
        const time = new Date(m.sent_at).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })
        return `
          <div style="padding: 12px 16px; margin-bottom: 8px; background: #f7f5f0; border-radius: 8px; border-left: 3px solid #8B9D77;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #8B9D77; font-weight: 600;">${m.sender_name} · ${time}</p>
            <p style="margin: 0; font-size: 14px; color: #2d2d2d; line-height: 1.5;">${m.body}</p>
          </div>
        `
      }).join('')

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background-color: #faf9f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e4de;">
              <h2 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 300; color: #2d2d2d;">New Messages</h2>
              <p style="margin: 0 0 24px 0; font-size: 13px; color: #999;">${eventTitle}</p>
              
              ${messageListHtml}
              
              <div style="text-align: center; margin-top: 28px;">
                <a href="${portalUrl}" style="display: inline-block; background: #8B9D77; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
                  View in your planning portal
                </a>
              </div>
            </div>
            <p style="text-align: center; font-size: 11px; color: #bbb; margin-top: 20px;">
              Gilbertsville Farmhouse · Gilbertsville, NY
            </p>
          </div>
        </body>
        </html>
      `

      // For now, log the email (actual sending would use an email service)
      console.log(`[process-message-queue] Would send to: ${row.recipient_email}`)
      console.log(`[process-message-queue] Subject: ${subject}`)
      console.log(`[process-message-queue] Messages count: ${messages.length}`)

      // Mark as sent
      await supabase
        .from('message_notification_queue')
        .update({ sent: true })
        .eq('id', row.id)

      processed++
    }

    return new Response(
      JSON.stringify({ processed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('process-message-queue error:', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

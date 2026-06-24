import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Receives Postmark inbound webhook POSTs and posts a couple's (or admin's) email reply
// into the matching event's message thread. Public function — auth via ?s=<POSTMARK_INBOUND_SECRET>.
// Sender must be a known user who is on the event (or role 'admin'). Idempotent on Postmark MessageID.

// Remove the sender's email signature and mobile sign-offs from a reply body.
function stripSignature(text: string): string {
  const lines = text.split('\n')
  // Standard signature delimiter line "-- " (Gmail, Apple Mail, etc.).
  const idx = lines.findIndex((l) => l.trim() === '--')
  let out = idx >= 0 ? lines.slice(0, idx).join('\n') : text
  // Trim common mobile sign-offs at the end.
  out = out.replace(/\n+\s*Sent from my (iPhone|iPad|Android|mobile device|phone).*$/is, '')
  return out.trim()
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get('s')
    if (!secret || secret !== Deno.env.get('POSTMARK_INBOUND_SECRET')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const p = await req.json()
    const postmarkId: string | null = p.MessageID ?? null
    const fromEmail: string = (p.FromFull?.Email ?? p.From ?? '').trim().toLowerCase()
    let token: string = (p.MailboxHash ?? '').trim()
    if (!token) {
      const rcpt = String(p.OriginalRecipient ?? p.To ?? '')
      const m = rcpt.match(/\+([^@]+)@/)
      if (m) token = m[1]
    }
    const subject: string | null = p.Subject ?? null
    const bodyRaw: string = (p.StrippedTextReply && String(p.StrippedTextReply).trim())
      ? String(p.StrippedTextReply)
      : String(p.TextBody ?? '')
    const body = stripSignature(bodyRaw)

    async function log(status: string, extra: Record<string, unknown> = {}) {
      await supabase.from('inbound_emails').insert({
        postmark_message_id: postmarkId,
        from_email: fromEmail,
        subject,
        status,
        ...extra,
      }).then(() => {}, () => {})
    }

    // Idempotency: skip messages we've already processed.
    if (postmarkId) {
      const { data: existing } = await supabase
        .from('inbound_emails')
        .select('id')
        .eq('postmark_message_id', postmarkId)
        .maybeSingle()
      if (existing) return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 })
    }

    if (!token) {
      await log('rejected_no_token')
      return new Response(JSON.stringify({ ok: true, ignored: 'no_token' }), { status: 200 })
    }

    const { data: route } = await supabase
      .from('message_reply_routes')
      .select('event_id')
      .eq('token', token)
      .maybeSingle()
    if (!route) {
      await log('rejected_unknown_route')
      return new Response(JSON.stringify({ ok: true, ignored: 'unknown_route' }), { status: 200 })
    }
    const eventId = route.event_id as string

    if (!fromEmail) {
      await log('rejected_no_sender', { event_id: eventId })
      return new Response(JSON.stringify({ ok: true, ignored: 'no_sender' }), { status: 200 })
    }

    const { data: usr } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', fromEmail)
      .maybeSingle()
    if (!usr) {
      await log('rejected_unknown_sender', { event_id: eventId })
      return new Response(JSON.stringify({ ok: true, ignored: 'unknown_sender' }), { status: 200 })
    }

    const { data: eu } = await supabase
      .from('event_users')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', usr.id)
      .maybeSingle()

    if (!eu && usr.role !== 'admin') {
      await log('rejected_not_on_event', { event_id: eventId, matched_user_id: usr.id })
      return new Response(JSON.stringify({ ok: true, ignored: 'not_on_event' }), { status: 200 })
    }

    if (!body) {
      await log('rejected_empty', { event_id: eventId, matched_user_id: usr.id })
      return new Response(JSON.stringify({ ok: true, ignored: 'empty' }), { status: 200 })
    }

    const { data: inserted, error: insErr } = await supabase
      .from('messages')
      .insert({
        event_id: eventId,
        sender_id: usr.id,
        sender_event_user_id: eu?.id ?? null,
        body,
        mentions: [],
      })
      .select('id')
      .single()
    if (insErr) {
      await log('error', { event_id: eventId, matched_user_id: usr.id })
      console.error('[postmark-inbound] insert message failed', insErr)
      return new Response(JSON.stringify({ ok: false }), { status: 200 })
    }

    await log('posted', { event_id: eventId, matched_user_id: usr.id, created_message_id: inserted.id })

    // Notify the other side, mirroring in-app behavior. Never block on failure.
    supabase.functions.invoke('enqueue-message-notification', {
      body: { event_id: eventId, sender_id: usr.id, message_body: body },
    }).catch((e) => console.warn('[postmark-inbound] enqueue failed', e))

    return new Response(JSON.stringify({ ok: true, message_id: inserted.id }), { status: 200 })
  } catch (err) {
    console.error('postmark-inbound-message error:', err)
    // 200 so Postmark does not retry a malformed payload forever.
    return new Response(JSON.stringify({ ok: false }), { status: 200 })
  }
})

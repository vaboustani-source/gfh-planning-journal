// Admin-only restore: revert an UPDATE or restore a DELETE from an audit_log entry.
// All actual mutation logic lives in the SECURITY DEFINER SQL function
// `public.restore_audit_record`, which runs in a single transaction and only
// writes columns that currently exist on the target table.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_TABLES = new Set([
  'vendors', 'checklist_items', 'ceremony_details', 'bar_selections',
  'dietary_restrictions', 'financials', 'financial_line_items', 'budget_items',
  'event_budgets', 'payment_schedule', 'decor_selections', 'experience_requests',
  'milestones', 'guests', 'guest_dietary_entries', 'documents',
  'menu_finalization', 'seating_tables', 'seating_assignments', 'working_timeline',
])

const VALID_MODES = new Set(['revert_update', 'restore_delete'])

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Authn
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) {
      return json(401, { success: false, error: 'Not authenticated' })
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
    if (userErr || !userData?.user) {
      return json(401, { success: false, error: 'Not authenticated' })
    }

    // Authz: must be admin
    const { data: profile } = await supabase
      .from('users').select('role').eq('id', userData.user.id).maybeSingle()
    if (profile?.role !== 'admin') {
      return json(403, { success: false, error: 'Not authorized' })
    }

    // Input
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return json(400, { success: false, error: 'Invalid request body' })
    }
    const { table_name, record_id, audit_id, mode } = body as Record<string, unknown>

    if (typeof table_name !== 'string' || !ALLOWED_TABLES.has(table_name)) {
      return json(400, { success: false, error: 'This area is not restorable.' })
    }
    if (typeof audit_id !== 'string' || typeof record_id !== 'string') {
      return json(400, { success: false, error: 'Missing audit_id or record_id' })
    }
    if (typeof mode !== 'string' || !VALID_MODES.has(mode)) {
      return json(400, { success: false, error: 'Invalid mode' })
    }

    // Verify the audit entry matches the claimed table/record
    const { data: entry, error: entryErr } = await supabase
      .from('audit_log')
      .select('id, table_name, record_id, action')
      .eq('id', audit_id)
      .maybeSingle()
    if (entryErr) return json(500, { success: false, error: entryErr.message })
    if (!entry) return json(404, { success: false, error: 'History entry not found.' })
    if (entry.table_name !== table_name || entry.record_id !== record_id) {
      return json(400, { success: false, error: 'History entry does not match the target record.' })
    }
    if (mode === 'revert_update' && entry.action !== 'UPDATE') {
      return json(400, { success: false, error: 'This entry is not an update and cannot be reverted.' })
    }
    if (mode === 'restore_delete' && entry.action !== 'DELETE') {
      return json(400, { success: false, error: 'This entry is not a deletion and cannot be restored.' })
    }

    // Hand off to the transactional SQL function
    const { data: rpcData, error: rpcErr } = await supabase.rpc('restore_audit_record', {
      p_audit_id: audit_id,
      p_mode: mode,
    })
    if (rpcErr) return json(500, { success: false, error: rpcErr.message })

    const result = (rpcData ?? {}) as { success?: boolean; summary?: string; error?: string }
    return json(result.success ? 200 : 400, {
      success: !!result.success,
      summary: result.summary ?? null,
      error: result.error ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json(500, { success: false, error: message })
  }
})

import { createClient } from 'npm:@supabase/supabase-js@2'

// TEMPORARY QA HELPER — throwaway users for auth tests. Delete after validation.
Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const body = await req.json().catch(() => ({}))

  if (body?.cleanup_user_id) {
    if (body.cleanup_email) await admin.from('team_members').delete().eq('email', body.cleanup_email)
    if (body.cleanup_media_id) await admin.from('training_drive_media').delete().eq('id', body.cleanup_media_id)
    await admin.auth.admin.deleteUser(body.cleanup_user_id)
    return new Response(JSON.stringify({ deleted: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  const email = `qa-member-${crypto.randomUUID()}@example.com`
  const password = crypto.randomUUID() + 'Aa1!'
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  if (body?.as_active_member) {
    const { error: tmErr } = await admin.from('team_members').insert({
      nome_completo: 'QA Teste Automatizado',
      email,
      whatsapp_number: '0000000000',
      role: 'vendedor',
      ativo: true,
    })
    if (tmErr) return new Response(JSON.stringify({ error: `team_members: ${tmErr.message}` }), { status: 500 })
  }

  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email, password })
  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500 })
  return new Response(JSON.stringify({ user_id: created.user!.id, email, access_token: sess.session!.access_token }), { headers: { 'Content-Type': 'application/json' } })
})

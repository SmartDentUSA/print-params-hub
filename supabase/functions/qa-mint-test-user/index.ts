import { createClient } from 'npm:@supabase/supabase-js@2'

// TEMPORARY QA HELPER — mints a throwaway confirmed user with no permissions.
Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const body = await req.json().catch(() => ({}))
  if (body?.cleanup_user_id) {
    await admin.auth.admin.deleteUser(body.cleanup_user_id)
    return new Response(JSON.stringify({ deleted: true }), { headers: { 'Content-Type': 'application/json' } })
  }
  const email = `qa-noperm-${crypto.randomUUID()}@example.com`
  const password = crypto.randomUUID() + 'Aa1!'
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email, password })
  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500 })
  return new Response(JSON.stringify({ user_id: created.user!.id, access_token: sess.session!.access_token }), { headers: { 'Content-Type': 'application/json' } })
})

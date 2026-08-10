import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    if (!currentUser) throw new Error('Usuário não autenticado');

    const { data: isAdminData, error: adminError } = await supabaseClient
      .rpc('is_admin', { user_id: currentUser.id });
    if (adminError || !isAdminData) {
      throw new Error('Acesso negado: apenas administradores podem listar usuários');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Paginar toda a base de usuários
    const all: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      all.push(...(data?.users ?? []));
      if (!data || data.users.length < 200) break;
      page++;
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');
    if (rolesError) throw rolesError;

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    const users = all.map((u) => ({
      id: u.id,
      email: u.email ?? '(sem e-mail)',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed: Boolean(u.email_confirmed_at),
      roles: rolesByUser.get(u.id) ?? [],
    })).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

    return new Response(JSON.stringify({ success: true, total: users.length, users }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'Erro ao listar usuários' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

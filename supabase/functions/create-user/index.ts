import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação do admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar se o usuário atual é admin
    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    if (!currentUser) {
      throw new Error('Usuário não autenticado');
    }

    const { data: isAdminData, error: adminError } = await supabaseClient
      .rpc('is_admin', { user_id: currentUser.id });

    if (adminError || !isAdminData) {
      console.error('Erro ao verificar admin:', adminError);
      throw new Error('Acesso negado: apenas administradores podem criar usuários');
    }

    // Obter dados da requisição
    const { email, password, role } = await req.json();

    if (!email || !password || !role) {
      throw new Error('Email, senha e role são obrigatórios');
    }

    console.log(`Criando usuário: ${email} com role: ${role}`);

    // Criar usuário usando service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Email já confirmado automaticamente
    });

    if (userError) {
      console.error('Erro ao criar usuário:', userError);
      throw userError;
    }

    console.log('Usuário criado com sucesso:', userData.user.id);

    // Inserir role na tabela user_roles
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role: role
      });

    if (roleError) {
      console.error('Erro ao inserir role:', roleError);
      // Se falhar ao inserir role, deletar o usuário criado
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      throw new Error(`Erro ao atribuir permissão: ${roleError.message}`);
    }

    console.log('Role atribuída com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: userData.user.id,
          email: userData.user.email,
        },
        credentials: { 
          email, 
          password 
        },
        message: 'Usuário criado com sucesso. Envie as credenciais manualmente.'
      }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );
  } catch (error) {
    console.error('Erro na criação de usuário:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao criar usuário'
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});

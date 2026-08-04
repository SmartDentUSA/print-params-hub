// Aprovação humana de um entregável de treinamento → cria o post agendado.
// Requer JWT de usuário do Sistema B com permissão can_manage_training_media.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Credencial ausente" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: allowed, error: permErr } = await admin.rpc("can_manage_training_media", { _user_id: user.id });
    if (permErr) throw new Error(`permissão: ${permErr.message}`);
    if (!allowed) return json({ error: "Sem permissão para aprovar entregáveis" }, 403);

    const body = await req.json().catch(() => ({}));
    const deliverableId = String(body?.deliverable_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deliverableId)) {
      return json({ error: "deliverable_id inválido" }, 400);
    }
    const scheduledAt = body?.scheduled_at ? new Date(String(body.scheduled_at)) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return json({ error: "scheduled_at inválido" }, 400);
    }

    const { data, error } = await admin.rpc("approve_training_deliverable", {
      _deliverable_id: deliverableId,
      _scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
    });
    if (error) throw new Error(error.message);

    await admin
      .from("training_social_deliverables")
      .update({ approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", deliverableId);

    return json({ ok: true, result: data });
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 400);
    console.error("[training-deliverable-approve]", msg);
    return json({ error: msg }, 500);
  }
});
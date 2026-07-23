// smart-ops-lia-notify-seller — v33
// Envia briefing SmartOps para o vendedor via Evolution API.
// Substitui a versão fantasma (v32) que ainda usava o header antigo
// "🤖 Novo Lead - Dra. L.I.A.". Agora delega ao buildSellerNotification
// compartilhado, que já formata com "📊 Análise SmartOps".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSellerNotification } from "../_shared/waleads-messaging.ts";
import { EVO_BASE, EVO_KEY, normalizePhone } from "../_shared/evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDER_INSTANCE = Deno.env.get("NOTIFY_SELLER_INSTANCE") ?? "Danilo Henrique";
const LOCK_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const lead_id = body?.lead_id as string | undefined;
    const team_member_id = body?.team_member_id as string | undefined;
    const trigger = (body?.trigger as string | undefined) || "unknown";

    if (!lead_id || !team_member_id) {
      return json({ error: "lead_id and team_member_id are required" }, 400);
    }

    // ── Dedup lock (últimas 24h) ──
    const sinceIso = new Date(Date.now() - LOCK_HOURS * 3600 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("message_logs")
      .select("id")
      .eq("lead_id", lead_id)
      .in("tipo", ["briefing_vendedor", "briefing_vendedor_block"])
      .gte("created_at", sinceIso)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      console.log(`[notify-seller v33] Lock existente lead=${lead_id} — skip`);
      return json({ skipped: true, reason: "lock" });
    }

    // ── Fetch lead + seller ──
    const [{ data: lead, error: leadErr }, { data: seller, error: sellerErr }] = await Promise.all([
      supabase.from("lia_attendances").select("*").eq("id", lead_id).maybeSingle(),
      supabase
        .from("team_members")
        .select("id, nome_completo, whatsapp_number, evolution_instance_name, evolution_api_key")
        .eq("id", team_member_id)
        .maybeSingle(),
    ]);

    if (leadErr || !lead) return json({ error: `lead not found: ${leadErr?.message || lead_id}` }, 404);
    if (sellerErr || !seller) return json({ error: `seller not found: ${sellerErr?.message || team_member_id}` }, 404);

    const rawPhone = (seller as any).whatsapp_number as string | null;
    const cleanPhone = normalizePhone(rawPhone || "");
    if (!cleanPhone || cleanPhone.length < 10) {
      await logMsg(supabase, {
        lead_id, team_member_id, whatsapp_number: rawPhone,
        tipo: "briefing_vendedor_block", status: "erro",
        evolution_instance: SENDER_INSTANCE,
        mensagem_preview: null,
        error_details: "seller_missing_whatsapp",
      });
      return json({ error: "seller missing whatsapp_number" }, 422);
    }
    const toNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // ── Build briefing (header já é "📊 Análise SmartOps") ──
    const briefing = await buildSellerNotification(lead as Record<string, unknown>, supabase);

    // ── Send via Evolution (sempre pela instância sender configurada) ──
    let status: "enviado" | "erro" = "enviado";
    let errorDetails: string | null = null;
    try {
      const res = await fetch(
        `${EVO_BASE}/message/sendText/${encodeURIComponent(SENDER_INSTANCE)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVO_KEY },
          body: JSON.stringify({ number: toNumber, text: briefing }),
          signal: AbortSignal.timeout(60_000),
        }
      );
      if (!res.ok) {
        status = "erro";
        errorDetails = `sendText ${res.status}: ${(await res.text()).slice(0, 300)}`;
      }
    } catch (e) {
      status = "erro";
      errorDetails = e instanceof Error ? e.message : String(e);
    }

    await logMsg(supabase, {
      lead_id,
      team_member_id,
      whatsapp_number: toNumber,
      tipo: "briefing_vendedor",
      status,
      evolution_instance: SENDER_INSTANCE,
      mensagem_preview: briefing.slice(0, 900),
      error_details: errorDetails,
    });

    console.log(`[notify-seller v33] lead=${lead_id} seller=${seller.nome_completo} status=${status} trigger=${trigger}`);
    return json({ success: status === "enviado", status, error: errorDetails });
  } catch (err) {
    console.error("[notify-seller v33] fatal:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logMsg(
  supabase: ReturnType<typeof createClient>,
  row: {
    lead_id: string;
    team_member_id: string;
    whatsapp_number: string | null;
    tipo: string;
    status: string;
    evolution_instance: string;
    mensagem_preview: string | null;
    error_details?: string | null;
  }
) {
  try {
    await supabase.from("message_logs").insert({
      lead_id: row.lead_id,
      team_member_id: row.team_member_id,
      whatsapp_number: row.whatsapp_number,
      tipo: row.tipo,
      status: row.status,
      evolution_instance: row.evolution_instance,
      mensagem_preview: row.mensagem_preview,
      error_details: row.error_details ?? null,
      data_envio: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[notify-seller v33] log insert failed:", e);
  }
}
// smart-ops-lia-notify-seller — v36
// Envia briefing SmartOps para o vendedor via Evolution API, sempre pela
// instância institucional de marketing.
// Substitui a versão fantasma (v32) que ainda usava o header antigo
// "🤖 Novo Lead - Dra. L.I.A.". Agora delega ao buildSellerNotification
// compartilhado, que já formata com "📊 Análise SmartOps".
//
// v36 desfaz a fila de pendentes: aceita seller_name/seller_phone (como os
// triggers do banco chamam), tranca só em briefing entregue e fecha a linha
// 'pendente' gravada pelo trigger em vez de abandoná-la.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSellerNotification } from "../_shared/waleads-messaging.ts";
import { EVO_BASE, EVO_KEY, normalizePhone } from "../_shared/evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Instância padrão de envio: a antiga "Danilo Henrique" não existe mais no Evolution
// (404 desde 24/jul/2026). Fallback agora é smartdent_marketing.
// TODO envio institucional (briefing/novos leads/avisos) sai SEMPRE pela instância
// de marketing. A antiga "Danilo Henrique" foi aposentada.
const SENDER_INSTANCE = Deno.env.get("NOTIFY_SELLER_INSTANCE") ?? "smartdent_marketing";
const LOCK_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const lead_id = body?.lead_id as string | undefined;
    const trigger = (body?.trigger as string | undefined) || "unknown";

    // Os triggers do banco (fn_notify_seller_on_lead_assigned,
    // fn_trigger_briefing_notify_seller, fn_trigger_briefing_vendedor_imediato)
    // chamam com seller_name/seller_phone; o smart-ops-lia-assign chama com
    // team_member_id. Exigir só team_member_id fazia todo envio por trigger
    // morrer em 400 antes de chegar no envio.
    let team_member_id = body?.team_member_id as string | undefined;
    const sellerName = (body?.seller_name as string | undefined)?.trim() || null;
    const sellerPhone = (body?.seller_phone as string | undefined)?.trim() || null;

    if (!lead_id) return json({ error: "lead_id is required" }, 400);

    if (!team_member_id && (sellerName || sellerPhone)) {
      team_member_id = await resolveTeamMemberId(supabase, sellerName, sellerPhone);
    }

    if (!team_member_id) {
      return json(
        { error: "team_member_id, seller_name or seller_phone is required", lead_id },
        400
      );
    }

    // ── Dedup lock (últimas 24h) ──
    // Só briefing efetivamente entregue trava um novo envio. As linhas
    // 'pendente' são reserva gravada pelo trigger ANTES da chamada — se
    // entrarem no lock, a própria reserva impede o envio que ela deveria
    // proteger.
    const sinceIso = new Date(Date.now() - LOCK_HOURS * 3600 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("message_logs")
      .select("id")
      .eq("lead_id", lead_id)
      .in("tipo", ["briefing_vendedor", "briefing_vendedor_block"])
      .eq("status", "enviado")
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

    // Sender fixo: instância de marketing (credencial própria dela, nunca a do vendedor)
    const senderInstance = SENDER_INSTANCE;
    const { data: senderRow } = await supabase
      .from("team_members")
      .select("evolution_api_key")
      .eq("evolution_instance_name", senderInstance)
      .not("evolution_api_key", "is", null)
      .limit(1)
      .maybeSingle();
    const senderKey = ((senderRow as any)?.evolution_api_key as string | null)?.trim() || EVO_KEY;

    const rawPhone = (seller as any).whatsapp_number as string | null;
    const cleanPhone = normalizePhone(rawPhone || "");
    if (!cleanPhone || cleanPhone.length < 10) {
      await logMsg(supabase, {
        lead_id, team_member_id, whatsapp_number: rawPhone,
        tipo: "briefing_vendedor_block", status: "erro",
        evolution_instance: senderInstance,
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
        `${EVO_BASE}/message/sendText/${encodeURIComponent(senderInstance)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: senderKey },
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
      evolution_instance: senderInstance,
      mensagem_preview: briefing.slice(0, 900),
      error_details: errorDetails,
    });

    console.log(`[notify-seller v34] lead=${lead_id} seller=${seller.nome_completo} instance=${senderInstance} status=${status} trigger=${trigger}`);
    return json({ success: status === "enviado", status, error: errorDetails });
  } catch (err) {
    console.error("[notify-seller v33] fatal:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// Resolve o vendedor a partir do nome (como vem do CRM em
// proprietario_lead_crm) ou do telefone, para atender as chamadas dos triggers.
async function resolveTeamMemberId(
  supabase: ReturnType<typeof createClient>,
  sellerName: string | null,
  sellerPhone: string | null
): Promise<string | undefined> {
  if (sellerName) {
    const { data } = await supabase
      .from("team_members")
      .select("id")
      .eq("ativo", true)
      .ilike("nome_completo", sellerName)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }

  if (sellerPhone) {
    const digits = normalizePhone(sellerPhone);
    if (digits.length >= 10) {
      const suffix = digits.slice(-9);
      const { data } = await supabase
        .from("team_members")
        .select("id, whatsapp_number")
        .eq("ativo", true)
        .not("whatsapp_number", "is", null)
        .returns<{ id: string; whatsapp_number: string }[]>();
      const hit = data?.find(
        (r) => normalizePhone(String(r.whatsapp_number)).slice(-9) === suffix
      );
      if (hit?.id) return hit.id;
    }
  }

  return undefined;
}

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
  const payload = {
    lead_id: row.lead_id,
    team_member_id: row.team_member_id,
    whatsapp_number: row.whatsapp_number,
    tipo: row.tipo,
    status: row.status,
    evolution_instance: row.evolution_instance,
    mensagem_preview: row.mensagem_preview,
    error_details: row.error_details ?? null,
    data_envio: new Date().toISOString(),
  };

  try {
    // O trigger grava uma linha 'pendente' antes de chamar esta função. Fechamos
    // essa mesma linha com o resultado real em vez de abrir outra — era isso que
    // deixava a fila de pendentes crescendo indefinidamente.
    const { data: pending } = await supabase
      .from("message_logs")
      .select("id")
      .eq("lead_id", row.lead_id)
      .eq("tipo", "briefing_vendedor")
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (pending?.id) {
      await supabase.from("message_logs").update(payload).eq("id", pending.id);
    } else {
      await supabase.from("message_logs").insert(payload);
    }
  } catch (e) {
    console.warn("[notify-seller v36] log write failed:", e);
  }
}
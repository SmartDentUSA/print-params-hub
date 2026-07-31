// cs-enviar-nps — cron diário 08h.
// Envia o link de NPS (token opaco) por WhatsApp via instância CS (cs_principal).
// Idempotente: nps_sent_at só é gravado após envio confirmado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FN = "cs-enviar-nps";
const CS_INSTANCE = Deno.env.get("CS_EVOLUTION_INSTANCE") ?? "cs_principal";
const EVO_BASE_DEFAULT = Deno.env.get("EVOLUTION_API_URL") ?? "http://82.25.75.61:8080";
const GLOBAL_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "SmartDent_LIA_2026";
// Domínio público da página /nps/:token (ajustável por secret sem redeploy).
const NPS_BASE_URL = (Deno.env.get("NPS_PUBLIC_BASE_URL") ?? "https://admin.smartdent.com.br").replace(/\/+$/, "");

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function firstName(n?: string | null): string {
  const s = (n ?? "").trim().split(/\s+/)[0] ?? "";
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const log = async (severity: string, error_type: string, details: unknown) => {
    try {
      await supabase.from("system_health_logs").insert({
        function_name: FN, severity, error_type, details,
      });
    } catch { /* silencioso */ }
  };

  try {
    // Instância CS (Ana Paula) — mesmo canal já usado pelo CS.
    const { data: tm } = await supabase
      .from("team_members")
      .select("evolution_instance_name, evolution_api_key, evolution_base_url, evolution_enabled, evolution_status")
      .eq("evolution_instance_name", CS_INSTANCE)
      .maybeSingle();

    if (!tm || tm.evolution_enabled !== true) {
      await log("error", "cs_instance_indisponivel", { instance: CS_INSTANCE, enabled: tm?.evolution_enabled ?? null });
      return new Response(JSON.stringify({ ok: false, error: "cs_instance_indisponivel" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const baseUrl = ((tm.evolution_base_url as string) || EVO_BASE_DEFAULT).replace(/\/+$/, "");
    const apikey = (tm.evolution_api_key as string) || GLOBAL_KEY;
    const instance = tm.evolution_instance_name as string;

    // Guarda de conexão: não tentar enviar de instância offline.
    try {
      const st = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`, {
        headers: { apikey },
        signal: AbortSignal.timeout(15_000),
      });
      const stJson = await st.json().catch(() => null);
      const state = stJson?.instance?.state ?? stJson?.state ?? null;
      if (state !== "open") {
        await log("error", "cs_instance_offline", { instance, state });
        return new Response(JSON.stringify({ ok: false, error: "cs_instance_offline", state }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      await log("error", "connection_state_falhou", { instance, message: String((e as Error)?.message ?? e) });
      return new Response(JSON.stringify({ ok: false, error: "connection_state_falhou" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Turmas que terminaram ontem, sem NPS enviado.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { data: turmas, error: eT } = await supabase
      .from("smartops_course_turmas")
      .select("id, label, end_date")
      .eq("end_date", yesterday);
    if (eT) throw eT;

    const turmaIds = (turmas ?? []).map((t: any) => t.id);
    if (turmaIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, elegiveis: 0, enviados: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: enrollments, error: eE } = await supabase
      .from("smartops_course_enrollments")
      .select("id, lead_id, turma_id, person_name, nps_sent_at")
      .in("turma_id", turmaIds)
      .is("nps_sent_at", null)
      .not("lead_id", "is", null);
    if (eE) throw eE;

    const list = enrollments ?? [];
    let enviados = 0;
    const falhas: unknown[] = [];

    for (const enr of list as any[]) {
      try {
        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("id, nome, telefone_normalized")
          .eq("id", enr.lead_id)
          .maybeSingle();

        const phone = (lead?.telefone_normalized as string | null)?.replace(/\D/g, "") ?? "";
        if (!phone || phone.length < 12) {
          falhas.push({ enrollment_id: enr.id, motivo: "telefone_invalido" });
          await log("warning", "telefone_invalido", { enrollment_id: enr.id, lead_id: enr.lead_id });
          continue;
        }

        const token = newToken();
        const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
        const { error: eUpd } = await supabase
          .from("smartops_course_enrollments")
          .update({ nps_token: token, nps_token_expires_at: expires })
          .eq("id", enr.id);
        if (eUpd) throw eUpd;

        const nome = firstName(enr.person_name ?? lead?.nome);
        const turma = (turmas ?? []).find((t: any) => t.id === enr.turma_id);
        const link = `${NPS_BASE_URL}/nps/${token}`;
        const text =
          `Olá${nome ? `, ${nome}` : ""}! Aqui é a Smart Dent 💙\n\n` +
          `Esperamos que o treinamento${turma?.label ? ` *${turma.label}*` : ""} tenha sido proveitoso.\n` +
          `Sua opinião é muito importante para continuarmos evoluindo — são só 3 perguntas rápidas (menos de 1 minuto):\n\n` +
          `${link}\n\nObrigado por fazer parte da nossa história!`;

        const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey },
          body: JSON.stringify({ number: `${phone}@s.whatsapp.net`, text }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) {
          const body = await res.text();
          falhas.push({ enrollment_id: enr.id, status: res.status });
          await log("error", "envio_whatsapp_falhou", {
            enrollment_id: enr.id, lead_id: enr.lead_id, status: res.status, body: body.slice(0, 500),
          });
          continue; // NÃO marca nps_sent_at — cron tenta de novo amanhã.
        }

        const { error: eSent } = await supabase
          .from("smartops_course_enrollments")
          .update({ nps_sent_at: new Date().toISOString(), nps_status: "aguardando" })
          .eq("id", enr.id);
        if (eSent) throw eSent;
        enviados++;
      } catch (e) {
        falhas.push({ enrollment_id: enr.id, message: String((e as Error)?.message ?? e) });
        await log("error", "erro_matricula", {
          enrollment_id: enr.id, message: String((e as Error)?.message ?? e),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, elegiveis: list.length, enviados, falhas: falhas.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[${FN}]`, err);
    await log("error", "internal_error", { message: String((err as Error)?.message ?? err) });
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
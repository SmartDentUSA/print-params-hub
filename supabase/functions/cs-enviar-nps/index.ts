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

  // Resolve credenciais/conexão da instância configurada no card do curso (fallback: CS).
  type Creds = { instance: string; baseUrl: string; apikey: string };
  const credsCache = new Map<string, Creds | null>();
  const resolveInstance = async (name: string): Promise<Creds | null> => {
    if (credsCache.has(name)) return credsCache.get(name) ?? null;
    let out: Creds | null = null;
    const { data: tm } = await supabase
      .from("team_members")
      .select("evolution_instance_name, evolution_api_key, evolution_base_url, evolution_enabled")
      .eq("evolution_instance_name", name)
      .maybeSingle();
    if (!tm || tm.evolution_enabled !== true) {
      await log("error", "instancia_indisponivel", { instance: name, enabled: tm?.evolution_enabled ?? null });
    } else {
      const baseUrl = ((tm.evolution_base_url as string) || EVO_BASE_DEFAULT).replace(/\/+$/, "");
      const apikey = (tm.evolution_api_key as string) || GLOBAL_KEY;
      try {
        const st = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(name)}`, {
          headers: { apikey },
          signal: AbortSignal.timeout(15_000),
        });
        const stJson = await st.json().catch(() => null);
        const state = stJson?.instance?.state ?? stJson?.state ?? null;
        if (state !== "open") await log("error", "instancia_offline", { instance: name, state });
        else out = { instance: name, baseUrl, apikey };
      } catch (e) {
        await log("error", "connection_state_falhou", { instance: name, message: String((e as Error)?.message ?? e) });
      }
    }
    credsCache.set(name, out);
    return out;
  };

  try {
    // Body opcional: { backfill_days: N } reenvia para todas as turmas encerradas
    // nos últimos N dias cujos participantes nunca receberam a pesquisa.
    let backfillDays = 0;
    try {
      const body = await req.json();
      const n = Number(body?.backfill_days);
      if (Number.isFinite(n) && n > 0) backfillDays = Math.min(Math.floor(n), 365);
    } catch { /* sem body = modo cron diário */ }

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const q = supabase.from("smartops_course_turmas").select("id, label, end_date");
    const { data: turmas, error: eT } = backfillDays > 0
      ? await q
          .gte("end_date", new Date(Date.now() - backfillDays * 86_400_000).toISOString().slice(0, 10))
          .lte("end_date", yesterday)
      : await q.eq("end_date", yesterday);
    if (eT) throw eT;

    const turmaIds = (turmas ?? []).map((t: any) => t.id);
    if (turmaIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, elegiveis: 0, enviados: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: enrollments, error: eE } = await supabase
      .from("smartops_course_enrollments")
      .select("id, lead_id, turma_id, course_id, person_name, nps_sent_at")
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

        const { data: courseRow } = await supabase
          .from("smartops_courses")
          .select("title, wa_instance_name, nps_message_template")
          .eq("id", enr.course_id)
          .maybeSingle();

        const creds = await resolveInstance((courseRow?.wa_instance_name as string | null) || CS_INSTANCE);
        if (!creds) {
          falhas.push({ enrollment_id: enr.id, motivo: "instancia_indisponivel" });
          continue;
        }
        const { instance, baseUrl, apikey } = creds;

        const nome = firstName(enr.person_name ?? lead?.nome);
        const turma = (turmas ?? []).find((t: any) => t.id === enr.turma_id);
        const link = `${NPS_BASE_URL}/nps/${token}`;
        const tpl = (courseRow?.nps_message_template as string | null) ||
          `Oie${nome ? " {{nome}}" : ""} espero qu esteja bem!\n\n` +
          `Sua opinião é muito importante para continuarmos evoluindo, são só 3 perguntas rápidas e resposta anônima pois queremos sua sinceridade (menos de 1 minuto):\n\n` +
          `{{link_nps}}`;
        let text = tpl
          .replace(/\{\{nome\}\}/g, nome)
          .replace(/\{\{curso\}\}/g, (courseRow?.title as string | null) ?? "")
          .replace(/\{\{turma_label\}\}/g, turma?.label ?? "")
          .replace(/\{\{link_nps\}\}/g, link)
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (!text.includes(link)) text = `${text}\n\n${link}`;

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

        // Timeline do lead: registra a mensagem completa enviada.
        try {
          await supabase.from("message_logs").insert({
            lead_id: enr.lead_id,
            tipo: "nps_whatsapp",
            mensagem_preview: text.slice(0, 1000),
            status: "enviado",
            whatsapp_number: phone,
            evolution_instance: instance,
            data_envio: new Date().toISOString(),
          });
          await supabase.from("lead_activity_log").insert({
            lead_id: enr.lead_id,
            event_type: "nps_convite_enviado",
            event_timestamp: new Date().toISOString(),
            source_channel: "whatsapp",
            entity_type: "enrollment",
            entity_id: String(enr.id),
            entity_name: "Convite NPS enviado",
            event_data: {
              kind: "nps",
              kind_label: "Convite NPS enviado",
              icon: "⭐",
              mensagem: text,
              link,
              telefone: phone,
              instancia: instance,
              turma: turma?.label ?? null,
              fonte: FN,
            },
          });
        } catch (_e) { /* timeline nunca bloqueia o envio */ }
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
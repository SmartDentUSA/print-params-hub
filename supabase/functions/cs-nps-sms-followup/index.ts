// cs-nps-sms-followup — follow-up de NPS por SMS (DisparoPro).
// Cron diário 08:00 (America/Sao_Paulo) + modo manual "Enviar agora".
// Envia o MESMO link exclusivo do participante (nps_token) enviado antes no WhatsApp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWaAutomationSetting } from "../_shared/wa-automation-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FN = "cs-nps-sms-followup";
const DISPARO_PRO_URL = "https://apihttp.disparopro.com.br:8433/mt";
const DISPARO_PRO_SERVICO = Deno.env.get("DISPARO_PRO_SERVICO") || "short";
const NPS_BASE_URL = (Deno.env.get("NPS_PUBLIC_BASE_URL") ?? "https://admin.smartdent.com.br").replace(/\/+$/, "");
// Encurtador próprio (rewrite /r/:code -> short-link-redirect). A DisparoPro
// bloqueia URLs longas/desconhecidas, então o SMS sempre sai com link curto.
const SHORT_BASE = (Deno.env.get("SHORT_LINK_BASE_R") ?? "https://admin.smartdent.com.br/r").replace(/\/+$/, "");

function randomCode(len = 6): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Reusa o short link já criado para o mesmo destino; só cria um novo se não existir.
async function shortenNpsLink(
  supabase: any,
  destination: string,
  leadId: string | null,
): Promise<string> {
  const { data: existing } = await supabase
    .from("short_links")
    .select("code")
    .eq("destination_url", destination)
    .limit(1)
    .maybeSingle();
  if (existing?.code) return `${SHORT_BASE}/${existing.code}`;

  for (let i = 0; i < 5; i++) {
    const code = randomCode(6);
    const { error } = await supabase.from("short_links").insert({
      code,
      destination_url: destination,
      lead_id: leadId,
      produto: "nps_sms",
    });
    if (!error) return `${SHORT_BASE}/${code}`;
  }
  return destination;
}

export const DEFAULT_NPS_SMS = "Oie {{nome}}! Sua opiniao sobre o treinamento e muito importante. 3 perguntas rapidas: {{link_nps}}";

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function firstName(n?: string | null): string {
  const s = (n ?? "").trim().split(/\s+/)[0] ?? "";
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const TOKEN = Deno.env.get("DISPARO_PRO_TOKEN");

  const log = async (severity: string, error_type: string, details: unknown) => {
    try {
      await supabase.from("system_health_logs").insert({ function_name: FN, severity, error_type, details });
    } catch { /* silencioso */ }
  };

  try {
    if (!TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "DISPARO_PRO_TOKEN não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let ids: string[] = [];
    let force = false;
    try {
      const body = await req.json();
      if (Array.isArray(body?.enrollment_ids)) ids = body.enrollment_ids.map(String).slice(0, 500);
      force = Boolean(body?.force) || ids.length > 0;
    } catch { /* cron */ }

    // Configuração editável na UI (Automações → "Automações sem UI").
    // Envio manual ("Enviar agora") ignora o desligamento global.
    const auto = await getWaAutomationSetting(supabase, "course_nps_sms_followup");
    if (!auto.ativo && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: "automacao_desligada", elegiveis: 0, enviados: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Candidatos: NPS já enviado (WhatsApp) e sem resposta
    let q = supabase
      .from("smartops_course_enrollments")
      .select("id, lead_id, course_id, turma_id, person_name, nps_sent_at, nps_token, nps_token_expires_at, nps_sms_count, nps_sms_last_sent_at")
      .not("lead_id", "is", null)
      .limit(500);
    q = ids.length ? q.in("id", ids) : q.not("nps_sent_at", "is", null);
    const { data: cands, error: eC } = await q;
    if (eC) throw eC;

    const list = cands ?? [];
    if (list.length === 0) {
      return new Response(JSON.stringify({ ok: true, elegiveis: 0, enviados: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quem já respondeu
    const { data: resp } = await supabase
      .from("smartops_nps_responses")
      .select("enrollment_id")
      .eq("survey_type", "pos_treinamento")
      .in("enrollment_id", list.map((e: any) => e.id));
    const responded = new Set((resp ?? []).map((r: any) => r.enrollment_id));

    // Config dos cursos
    const courseIds = [...new Set(list.map((e: any) => e.course_id).filter(Boolean))];
    const { data: courses } = courseIds.length
      ? await supabase
          .from("smartops_courses")
          .select("id, title, nps_sms_followup_enabled, nps_sms_template, nps_sms_delay_days, nps_sms_max_attempts")
          .in("id", courseIds)
      : { data: [] as any[] };
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c]));

    let enviados = 0;
    const falhas: unknown[] = [];
    const now = Date.now();

    for (const enr of list as any[]) {
      try {
        if (responded.has(enr.id)) continue;
        const course: any = courseMap.get(enr.course_id) ?? {};
        const maxAttempts = Number(course.nps_sms_max_attempts ?? 2);
        const delayDays = Number(course.nps_sms_delay_days ?? 2);
        const sent = Number(enr.nps_sms_count ?? 0);

        if (!force) {
          if (course.nps_sms_followup_enabled !== true) continue;
          if (maxAttempts > 0 && sent >= maxAttempts) continue;
          const base = enr.nps_sms_last_sent_at ?? enr.nps_sent_at;
          if (!base) continue;
          const elapsedDays = (now - new Date(base).getTime()) / 86_400_000;
          if (elapsedDays < delayDays) continue;
        }

        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("id, nome, telefone_normalized")
          .eq("id", enr.lead_id)
          .maybeSingle();
        const phone = normalizePhone((lead?.telefone_normalized as string | null) ?? "");
        if (!phone || phone.length < 12) {
          falhas.push({ enrollment_id: enr.id, motivo: "telefone_invalido" });
          continue;
        }

        // Reusa o link exclusivo já enviado; só cria se nunca existiu/expirou.
        let token = enr.nps_token as string | null;
        const expired = enr.nps_token_expires_at && new Date(enr.nps_token_expires_at).getTime() < now;
        if (!token || expired) {
          token = newToken();
          const { error: eT } = await supabase
            .from("smartops_course_enrollments")
            .update({ nps_token: token, nps_token_expires_at: new Date(now + 30 * 86_400_000).toISOString() })
            .eq("id", enr.id);
          if (eT) throw eT;
        }

        const fullLink = `${NPS_BASE_URL}/nps/${token}`;
        const link = await shortenNpsLink(supabase, fullLink, enr.lead_id ?? null);
        const nome = firstName(enr.person_name ?? lead?.nome);
        let text = String(course.nps_sms_template || auto.message_template || DEFAULT_NPS_SMS)
          .replace(/\{\{nome\}\}/g, nome)
          .replace(/\{\{curso\}\}/g, course.title ?? "")
          .replace(/\{\{link_nps\}\}/g, link)
          .replace(/\s+/g, " ")
          .trim();
        if (!text.includes(link)) text = `${text} ${link}`;

        const res = await fetch(DISPARO_PRO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify([{
            numero: phone,
            servico: DISPARO_PRO_SERVICO,
            mensagem: text,
            codificacao: "0",
            nome_campanha: "NPS Follow-up",
          }]),
          signal: AbortSignal.timeout(45_000),
        });
        const raw = await res.text();
        const accepted = res.ok && /ACCEPTED|"status"\s*:\s*"?(0|200|ok)/i.test(raw);
        if (!accepted) {
          falhas.push({ enrollment_id: enr.id, status: res.status, body: raw.slice(0, 300) });
          await log("error", "sms_falhou", { enrollment_id: enr.id, status: res.status, body: raw.slice(0, 500) });
          continue;
        }

        await supabase
          .from("smartops_course_enrollments")
          .update({ nps_sms_count: sent + 1, nps_sms_last_sent_at: new Date().toISOString() })
          .eq("id", enr.id);

        try {
          await supabase.from("message_logs").insert({
            lead_id: enr.lead_id,
            tipo: "nps_sms",
            mensagem_preview: text.slice(0, 1000),
            status: "enviado",
            whatsapp_number: phone,
            data_envio: new Date().toISOString(),
          });
          await supabase.from("lead_activity_log").insert({
            lead_id: enr.lead_id,
            event_type: "nps_followup_sms",
            event_timestamp: new Date().toISOString(),
            source_channel: "sms",
            entity_type: "enrollment",
            entity_id: String(enr.id),
            entity_name: "Follow-up NPS por SMS",
            event_data: {
              kind: "nps",
              kind_label: "Follow-up NPS por SMS",
              icon: "📩",
              mensagem: text,
              link,
              link_completo: fullLink,
              telefone: phone,
              tentativa: sent + 1,
              fonte: FN,
            },
          });
        } catch { /* timeline nunca bloqueia */ }

        enviados++;
      } catch (e) {
        falhas.push({ enrollment_id: enr.id, message: String((e as Error)?.message ?? e) });
        await log("error", "erro_matricula", { enrollment_id: enr.id, message: String((e as Error)?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, elegiveis: list.length, enviados, falhas: falhas.length, detalhes: falhas.slice(0, 10) }), {
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

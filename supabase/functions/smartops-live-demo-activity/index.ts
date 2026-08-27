/**
 * smartops-live-demo-activity
 * ---------------------------
 * Cria a atividade "Live agendada" (Planejada, 60 min, lembrete 5 min antes)
 * no deal atual do lead, no PipeRun, com a data/hora que o lead agendou.
 *
 * É chamada pela inscrição pública de demonstrações ao vivo DEPOIS do
 * smart-ops-ingest-lead → smart-ops-lia-assign (Regra de Ouro). Por isso ela
 * espera (poll) o deal aparecer antes de criar a atividade.
 *
 * NUNCA move, fecha ou altera deals — apenas cria a atividade.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { piperunGet } from "../_shared/piperun-field-map.ts";
import {
  createLiveScheduledActivity,
  LIVE_ACTIVITY_TYPE_NAME,
  resolveLiveSchedule,
} from "../_shared/piperun-live-activity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  lead_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  enrollment_id: z.string().uuid().optional(),
  course_title: z.string().max(200).optional(),
  wait_ms: z.number().int().min(0).max(30000).optional(),
});

const VENDAS_PATTERNS = [/vendas/i];
const OPEN_STATUS = new Set(["aberta", "aberto", "open", "1", "em andamento"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deal alvo: Vendas aberto > qualquer aberto > mais recente. */
function pickDeal(
  rows: Array<Record<string, any>>,
): Record<string, any> | null {
  if (rows.length === 0) return null;
  const isOpen = (d: Record<string, any>) =>
    OPEN_STATUS.has(String(d.status ?? "").toLowerCase());
  const vendasOpen = rows.find(
    (d) => isOpen(d) && VENDAS_PATTERNS.some((r) => r.test(String(d.pipeline_name ?? ""))),
  );
  return vendasOpen ?? rows.find(isOpen) ?? rows[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;
    const apiToken = Deno.env.get("PIPERUN_API_KEY");
    if (!apiToken) return json({ error: "piperun_token_missing" }, 500);

    // 1. Data/hora agendada
    const schedule = await resolveLiveSchedule(supabase, body.turma_id);
    if (!schedule) return json({ skipped: "sem_data_agendada" });

    // 2. Dedupe: uma atividade por inscrição
    const dedupeKey = `live_activity:${body.enrollment_id ?? `${body.lead_id}:${body.turma_id}`}`;
    {
      const { data: dup } = await supabase
        .from("lead_activity_log")
        .select("id")
        .eq("lead_id", body.lead_id)
        .eq("event_type", "crm_live_activity")
        .eq("event_data->>dedupe_key", dedupeKey)
        .limit(1);
      if ((dup?.length ?? 0) > 0) return json({ skipped: "already_created" });
    }

    // 3. Espera o deal que lia-assign acabou de resolver/criar
    const waitMs = body.wait_ms ?? 12000;
    const deadline = Date.now() + waitMs;
    let deal: Record<string, any> | null = null;
    while (true) {
      const { data: rows } = await supabase
        .from("deals")
        .select("piperun_deal_id, pipeline_name, status, owner_id, owner_name, piperun_created_at")
        .eq("lead_id", body.lead_id)
        .order("piperun_created_at", { ascending: false })
        .limit(20);
      deal = pickDeal(rows ?? []);
      if (deal?.piperun_deal_id) break;
      if (Date.now() >= deadline) break;
      await sleep(2000);
    }

    // Fallback: espelho local pode estar atrasado — usa o deal do CDP
    let dealId = Number(deal?.piperun_deal_id ?? 0);
    let ownerId = Number(deal?.owner_id ?? 0);
    if (!dealId) {
      const { data: lead } = await supabase
        .from("lia_attendances")
        .select("piperun_id")
        .eq("id", body.lead_id)
        .maybeSingle();
      dealId = Number(lead?.piperun_id ?? 0);
    }
    if (!dealId) return json({ skipped: "deal_nao_encontrado" });

    // Dono atual do deal é a autoridade para o responsável da atividade
    if (!ownerId) {
      const res = await piperunGet(apiToken, `deals/${dealId}`);
      const d = (res.data as { data?: any } | null)?.data;
      const raw = Array.isArray(d) ? d[0] : d;
      ownerId = Number(raw?.owner_id ?? 0);
    }

    // 4. Cria a atividade
    const courseTitle = body.course_title ?? "Demonstração ao vivo";
    const created = await createLiveScheduledActivity({
      apiToken,
      dealId,
      ownerId: ownerId || null,
      schedule,
      title: LIVE_ACTIVITY_TYPE_NAME,
      description: [
        `Live agendada: ${courseTitle}`,
        `Data: ${schedule.date.split("-").reverse().join("/")} às ${schedule.time}`,
        "Duração: 60 minutos",
      ].join("\n"),
    });

    if (!created.ok) {
      console.warn("[live-demo-activity] falhou:", created.error);
      await supabase.from("system_health_logs").insert({
        error_type: "live_activity_create_failed",
        function_name: "smartops-live-demo-activity",
        severity: "warning",
        lead_id: body.lead_id,
        details: { error: created.error ?? "unknown", deal_id: dealId, schedule },
      }).then(() => {}, () => {});
      return json({ ok: false, error: created.error }, 200);
    }

    // 5. Timeline do lead
    await supabase.from("lead_activity_log").insert({
      lead_id: body.lead_id,
      event_type: "crm_live_activity",
      entity_type: "piperun_activity",
      entity_id: String(created.activity_id),
      entity_name: LIVE_ACTIVITY_TYPE_NAME,
      event_timestamp: new Date().toISOString(),
      source_channel: "crm",
      event_data: {
        kind: "atividade",
        kind_label: "Atividade",
        icon: "📅",
        titulo: LIVE_ACTIVITY_TYPE_NAME,
        status: "Planejada",
        deal_id: dealId,
        owner_id: ownerId || null,
        owner: deal?.owner_name ?? null,
        data: schedule.date,
        hora: schedule.time,
        duracao_min: 60,
        lembrete_min: 5,
        curso: courseTitle,
        dedupe_key: dedupeKey,
        description: `Atividade "Live agendada" criada no deal ${dealId} para ${
          schedule.date.split("-").reverse().join("/")
        } às ${schedule.time}`,
      },
    }).then(() => {}, (e) => console.warn("[live-demo-activity] timeline", e));

    return json({
      ok: true,
      activity_id: created.activity_id,
      deal_id: dealId,
      owner_id: ownerId || null,
      schedule,
    });
  } catch (e) {
    console.error("[live-demo-activity]", e);
    return json({ error: String(e) }, 500);
  }
});

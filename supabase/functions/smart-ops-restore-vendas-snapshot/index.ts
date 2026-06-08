// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunPut } from "../_shared/piperun-field-map.ts";

/**
 * smart-ops-restore-vendas-snapshot
 *
 * Restaura deals do Funil de Vendas (18784) para o owner E etapa que possuíam
 * em um snapshot de data (default 2026-06-05), restrito a uma lista de owners
 * originais (vendedores). Cobre tanto deals que regrediram dentro do 18784
 * quanto deals que foram movidos para o Funil Estagnados (72938).
 *
 * NUNCA toca: valor, custom_fields, deals em CS Onboarding (83896), Ganhos,
 * deals ganhos/perdidos (status≠0) ou deals fora do snapshot eligível.
 *
 * Query params:
 *   ?dry_run=1                        (default 1)
 *   ?snapshot_date=2026-06-05         (default 2026-06-05)
 *   ?limit=2000                       (default 2000)
 *   ?offset=0                         (default 0)
 *   ?owner_ids=100952,102594,...      (default = 7 vendedores Smart Dent)
 */

const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PIPELINE_VENDAS = 18784;

// Vendedores Smart Dent (piperun_owner_id) — default da restauração.
const DEFAULT_OWNER_IDS: number[] = [
  100952, // Adriano Oliveira
  102594, // Daniel Ferreira
  33626,  // Evandro Silva
  51616,  // Janaína Santos
  47802,  // Lucas Silva
  95097,  // Paulo Sérgio
  77312,  // Thiago Godoy
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") !== "0";
  const snapshotDate = url.searchParams.get("snapshot_date") ?? "2026-06-05";
  const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") ?? "2000")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const ownerIdsParam = url.searchParams.get("owner_ids");
  const ownerIds = ownerIdsParam
    ? ownerIdsParam.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_OWNER_IDS;

  if (!PIPERUN_API_KEY) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Cutoff = fim do dia em America/Sao_Paulo (UTC-3).
  const snapshotCutoff = `${snapshotDate} 23:59:59-03`;

  // Map piperun_owner_id → nome atual em team_members (evita usar nome antigo
  // do snapshot quando o owner_id foi reassignado a outra pessoa no PipeRun).
  const { data: teamRows } = await supabase
    .from("team_members")
    .select("nome_completo, piperun_owner_id");
  const ownerNameById = new Map<number, string>();
  for (const t of (teamRows ?? []) as any[]) {
    const oid = Number(t.piperun_owner_id ?? 0);
    if (oid > 0 && t.nome_completo) ownerNameById.set(oid, String(t.nome_completo));
  }

  const { data: candidatesRaw, error: rpcErr } = await supabase.rpc(
    "vendas_restore_owner_stage_at",
    { cutoff: snapshotCutoff, owner_ids: ownerIds },
  );
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  type Action = {
    deal_id: string;
    lead_id: string | null;
    from_pipeline: number | null;
    from_stage_id: number | null;
    from_stage_name: string | null;
    from_owner_id: number | null;
    target_owner_id: number;
    target_owner_name: string;
    target_stage_id: number;
    target_stage_name: string;
  };
  const actions: Action[] = [];
  const stats: Record<string, unknown> = {
    snapshot_date: snapshotDate,
    owner_ids: ownerIds,
    dry_run: dryRun,
    candidates_from_rpc: (candidatesRaw ?? []).length,
    skipped_invalid: 0,
    candidates: 0,
    restored: 0,
    failed: 0,
  };

  for (const c of (candidatesRaw ?? []) as any[]) {
    const targetStageId = Number(c.snapshot_stage_id ?? 0);
    const targetOwnerId = Number(c.snapshot_owner_id ?? 0);
    if (!targetStageId || !targetOwnerId) { (stats.skipped_invalid as number)++; continue; }
    actions.push({
      deal_id: String(c.deal_id),
      lead_id: c.lead_id ? String(c.lead_id) : null,
      from_pipeline: c.current_pipeline_id ?? null,
      from_stage_id: c.current_stage_id ?? null,
      from_stage_name: c.current_stage_name ?? null,
      from_owner_id: c.current_owner_id ?? null,
      target_owner_id: targetOwnerId,
      target_owner_name: ownerNameById.get(targetOwnerId) || String(c.snapshot_owner_name ?? ""),
      target_stage_id: targetStageId,
      target_stage_name: String(c.snapshot_stage_name ?? ""),
    });
  }

  stats.candidates = actions.length;
  const slice = actions.slice(offset, offset + limit);
  const sample = slice.slice(0, 15);
  const errors: any[] = [];

  if (!dryRun) {
    for (const a of slice) {
      try {
        const put = await piperunPut(PIPERUN_API_KEY, `deals/${a.deal_id}`, {
          pipeline_id: PIPELINE_VENDAS,
          stage_id: a.target_stage_id,
          owner_id: a.target_owner_id,
          freezed: 0,
        });
        if (!put.success) {
          (stats.failed as number)++;
          errors.push({ deal_id: a.deal_id, status: put.status, data: put.data });
        } else {
          (stats.restored as number)++;
          if (a.lead_id) {
            await supabase.from("lia_attendances").update({
              piperun_pipeline_id: PIPELINE_VENDAS,
              piperun_pipeline_name: "Funil de vendas",
              piperun_stage_id: a.target_stage_id,
              piperun_stage_name: a.target_stage_name,
              piperun_owner_id: a.target_owner_id,
              proprietario_lead_crm: a.target_owner_name,
            }).eq("id", a.lead_id);
          }
          await supabase.from("deals").update({
            pipeline_id: PIPELINE_VENDAS,
            pipeline_name: "Funil de vendas",
            stage_id: a.target_stage_id,
            stage_name: a.target_stage_name,
            owner_id: a.target_owner_id,
            owner_name: a.target_owner_name,
            last_stage_updated_at: new Date().toISOString(),
          }).eq("piperun_deal_id", a.deal_id);

          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-restore-vendas-snapshot",
            error_type: "restore_vendas_snapshot",
            severity: "info",
            details: {
              deal_id: a.deal_id,
              lead_id: a.lead_id,
              from_pipeline: a.from_pipeline,
              from_stage_id: a.from_stage_id,
              from_stage_name: a.from_stage_name,
              from_owner_id: a.from_owner_id,
              to_stage_id: a.target_stage_id,
              to_stage_name: a.target_stage_name,
              to_owner_id: a.target_owner_id,
              to_owner_name: a.target_owner_name,
            } as any,
          });
        }
        await sleep(120);
      } catch (e) {
        (stats.failed as number)++;
        errors.push({ deal_id: a.deal_id, error: String(e) });
      }
    }
  } else {
    stats.restored = slice.length;
  }

  await supabase.from("system_health_logs").insert({
    function_name: "smart-ops-restore-vendas-snapshot",
    error_type: "restore_vendas_snapshot_summary",
    severity: (stats.failed as number) > 0 ? "warning" : "info",
    details: { ...stats, processed_slice: slice.length, offset } as any,
  });

  return new Response(JSON.stringify({ stats, processed_slice: slice.length, offset, sample, errors: errors.slice(0, 20) }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

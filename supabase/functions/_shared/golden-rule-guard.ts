// Golden Rule Guard — fonte única da verdade para criação de Deals VENDAS.
//
// Regra inquebrável (definida pelo usuário): NUNCA criar Deal novo se a Pessoa
// já tem QUALQUER deal VENDAS aberto OU criado/perdido nos últimos
// GOLDEN_RULE_WINDOW_DAYS dias. Re-entrega Meta NÃO é nova conversão.
//
// Deals CS são somente contexto: nunca são alterados e não bloqueiam uma nova
// oportunidade VENDAS quando existe uma conversão comercial confirmada.
// Bypass explícito: opts.force_new_deal === true (Loja Integrada "Sob Consulta",
// override manual explícito de SDR). Re-entrega Meta NUNCA usa bypass.

import { PIPELINES } from "./piperun-field-map.ts";

export const GOLDEN_RULE_WINDOW_DAYS = 30;

const PIPELINE_VENDAS = PIPELINES.VENDAS;

export interface GoldenRuleDeal {
  id: string | number;
  pipeline_id: number;
  status: number;
  freezed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GoldenRuleOptions {
  force_new_deal?: boolean;
  windowDays?: number;
}

export interface GoldenRuleVerdict {
  allowed: boolean;
  reason: string;
  preservedDeal?: GoldenRuleDeal;
}

export function assertCanCreateNewDeal(
  allDeals: GoldenRuleDeal[],
  opts: GoldenRuleOptions = {},
): GoldenRuleVerdict {
  if (opts.force_new_deal === true) {
    return { allowed: true, reason: "force_new_deal_bypass" };
  }

  // 1. Qualquer deal VENDAS ABERTO (não-freezed) → preservar.
  const openVendas = allDeals
    .filter(
      (d) =>
        Number(d.pipeline_id) === PIPELINE_VENDAS &&
        Number(d.status) === 0 &&
        !d.freezed,
    )
    .sort((a, b) =>
      String(b.updated_at ?? b.created_at ?? "").localeCompare(
        String(a.updated_at ?? a.created_at ?? ""),
      ),
    )[0];
  if (openVendas) {
    return {
      allowed: false,
      reason: "open_vendas_deal_exists",
      preservedDeal: openVendas,
    };
  }

  // 2. Deal VENDAS criado/atualizado nos últimos N dias (mesmo Perdido) → preservar.
  const windowDays = opts.windowDays ?? GOLDEN_RULE_WINDOW_DAYS;
  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const recentVendas = allDeals
    .filter((d) => Number(d.pipeline_id) === PIPELINE_VENDAS)
    .filter((d) => {
      const ts = new Date(String(d.updated_at ?? d.created_at ?? "")).getTime();
      return Number.isFinite(ts) && ts >= cutoffMs;
    })
    .sort((a, b) =>
      String(b.updated_at ?? b.created_at ?? "").localeCompare(
        String(a.updated_at ?? a.created_at ?? ""),
      ),
    )[0];
  if (recentVendas) {
    return {
      allowed: false,
      reason: `recent_vendas_deal_within_${windowDays}d`,
      preservedDeal: recentVendas,
    };
  }

  return { allowed: true, reason: "no_blocking_deal_found" };
}

// ─── Trava atômica DB-level — pré-createNewDeal (defense-in-depth) ──────────
// Impede que duas execuções concorrentes do lia-assign para o mesmo lead
// criem deals duplicados. Implementação: INSERT ON CONFLICT em
// `smartops_golden_rule_deal_locks` com TTL via RPC try_claim_deal_create_slot.

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export async function claimDealCreateSlot(
  supabase: SupabaseLike,
  leadId: string,
  personId: number | null,
  intentHash: string,
  ttlSeconds = 300,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.rpc("try_claim_deal_create_slot", {
      _lead_id: leadId,
      _person_id: personId ?? null,
      _intent_hash: intentHash,
      _ttl_seconds: ttlSeconds,
    });
    if (error) {
      console.warn(
        `[golden-rule] claimDealCreateSlot RPC error for lead=${leadId}:`,
        error,
      );
      // Em caso de erro de RPC, NÃO bloqueamos (evita lockout total). Apenas log.
      return { ok: true, reason: "rpc_error_failsafe_open" };
    }
    return { ok: Boolean(data), reason: data ? "claimed" : "lock_held" };
  } catch (e) {
    console.warn(
      `[golden-rule] claimDealCreateSlot threw for lead=${leadId}:`,
      e,
    );
    return { ok: true, reason: "rpc_throw_failsafe_open" };
  }
}

export async function releaseDealCreateSlot(
  supabase: SupabaseLike,
  leadId: string,
): Promise<void> {
  try {
    await supabase.rpc("release_deal_create_slot", { _lead_id: leadId });
  } catch (e) {
    console.warn(
      `[golden-rule] releaseDealCreateSlot threw for lead=${leadId}:`,
      e,
    );
  }
}

// ─── Cached Deal Validator (defense-in-depth #3) ─────────────────────────────
// Antes de qualquer createNewDeal, valida o `lead.piperun_id` cacheado direto
// via `GET /deals/:id`. Se o deal cacheado ainda está em VENDAS aberto e foi
// criado nos últimos `GOLDEN_RULE_WINDOW_DAYS` dias → preserva. Em caso de
// falha da chamada (timeout, 4xx, 5xx, 429) → preserva mesmo assim (fail-safe),
// porque um createNewDeal nesse cenário é a origem comprovada das duplicatas
// (Flavia Flores 2026-06-24: 429 em backfill seguido de empty list silencioso
// em findPersonDeals).

export interface CachedDealValidation {
  preserve: boolean;
  reason: string;
  deal_id?: string | number;
  pipeline_id?: number;
  status?: number;
  created_at?: string;
  fetch_ok?: boolean;
}

export async function validateCachedDealIsActiveVendas(
  cachedPiperunId: string | number | null | undefined,
  fetchDealById: (id: string | number) => Promise<{
    ok: boolean;
    deal?: Record<string, unknown> | null;
  }>,
  opts: { windowDays?: number } = {},
): Promise<CachedDealValidation> {
  const id = cachedPiperunId == null ? "" : String(cachedPiperunId).trim();
  if (!id) return { preserve: false, reason: "no_cached_piperun_id" };

  let result: { ok: boolean; deal?: Record<string, unknown> | null };
  try {
    result = await fetchDealById(id);
  } catch (e) {
    console.warn(
      `[golden-rule] validateCachedDeal fetch threw for deal=${id}:`,
      e,
    );
    return {
      preserve: true,
      reason: "preserve_cached_on_validation_failure",
      deal_id: id,
      fetch_ok: false,
    };
  }

  if (!result.ok) {
    return {
      preserve: true,
      reason: "preserve_cached_on_validation_failure",
      deal_id: id,
      fetch_ok: false,
    };
  }

  const deal = result.deal;
  if (!deal) {
    // Confirmed not found → safe to create new.
    return {
      preserve: false,
      reason: "cached_deal_not_found",
      deal_id: id,
      fetch_ok: true,
    };
  }

  const deleted = deal.deleted === 1 || deal.deleted === true;
  const pipelineId = Number(deal.pipeline_id);
  const status = Number(deal.status);
  const createdAt = String(deal.created_at ?? deal.updated_at ?? "");
  if (deleted) {
    return {
      preserve: false,
      reason: "cached_deal_deleted",
      deal_id: id,
      pipeline_id: pipelineId,
      status,
      created_at: createdAt,
      fetch_ok: true,
    };
  }

  const windowDays = opts.windowDays ?? GOLDEN_RULE_WINDOW_DAYS;
  const ts = new Date(createdAt).getTime();
  const withinWindow = Number.isFinite(ts)
    ? ts >= Date.now() - windowDays * 24 * 60 * 60 * 1000
    : false;

  const isOpen = status === 0;
  const isVendas = pipelineId === PIPELINE_VENDAS;

  if (isVendas && isOpen) {
    return {
      preserve: true,
      reason: "cached_deal_open_in_vendas",
      deal_id: id,
      pipeline_id: pipelineId,
      status,
      created_at: createdAt,
      fetch_ok: true,
    };
  }

  if (isVendas && withinWindow) {
    return {
      preserve: true,
      reason: `cached_deal_recent_vendas_within_${windowDays}d`,
      deal_id: id,
      pipeline_id: pipelineId,
      status,
      created_at: createdAt,
      fetch_ok: true,
    };
  }

  return {
    preserve: false,
    reason: isVendas ? "cached_deal_closed_outside_window" : "cached_deal_not_in_vendas",
    deal_id: id,
    pipeline_id: pipelineId,
    status,
    created_at: createdAt,
    fetch_ok: true,
  };
}
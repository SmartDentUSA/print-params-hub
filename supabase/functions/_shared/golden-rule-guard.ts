// Golden Rule Guard — fonte única da verdade para criação de Deals VENDAS.
//
// Regra inquebrável (definida pelo usuário): NUNCA criar Deal novo se a Pessoa
// já tem QUALQUER deal VENDAS aberto OU criado/perdido nos últimos
// GOLDEN_RULE_WINDOW_DAYS dias. Re-entrega Meta NÃO é nova conversão.
//
// Bypass único: opts.force_new_deal === true (Loja Integrada "Sob Consulta",
// override manual explícito de SDR). Re-entrega Meta NUNCA usa bypass.

import { PIPELINES } from "./piperun-field-map.ts";

export const GOLDEN_RULE_WINDOW_DAYS = 30;

const PIPELINE_VENDAS = PIPELINES.VENDAS;
const PIPELINE_CS_ONBOARDING = PIPELINES.CS_ONBOARDING;
const PIPELINE_GANHOS_ALEATORIOS_CS = PIPELINES.GANHOS_ALEATORIOS_CS;

const PROTECTED_PIPELINES = new Set<number>([
  PIPELINE_CS_ONBOARDING,
  PIPELINE_GANHOS_ALEATORIOS_CS,
]);

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

  // 3. Deal aberto em pipeline CS protegido → preservar (não criar deal novo).
  const openCs = allDeals.find(
    (d) =>
      PROTECTED_PIPELINES.has(Number(d.pipeline_id)) &&
      Number(d.status) === 0,
  );
  if (openCs) {
    return {
      allowed: false,
      reason: "open_cs_deal_protected",
      preservedDeal: openCs,
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
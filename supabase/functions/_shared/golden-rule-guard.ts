// Golden Rule Guard — fonte única da verdade para criação de Deals VENDAS.
//
// Regra inquebrável (definida pelo usuário): NUNCA criar Deal novo se a Pessoa
// já tem QUALQUER deal VENDAS aberto OU criado/perdido nos últimos
// GOLDEN_RULE_WINDOW_DAYS dias. Re-entrega Meta NÃO é nova conversão.
//
// Bypass único: opts.force_new_deal === true (Loja Integrada "Sob Consulta",
// override manual explícito de SDR). Re-entrega Meta NUNCA usa bypass.

export const GOLDEN_RULE_WINDOW_DAYS = 30;

// Pipeline constants duplicated here to avoid circular imports.
const PIPELINE_VENDAS = 251655;
const PIPELINE_CS_ONBOARDING = 273328;
const PIPELINE_GANHOS_ALEATORIOS_CS = 282651;

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
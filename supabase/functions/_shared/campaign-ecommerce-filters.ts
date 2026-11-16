// Cópia de src/lib/campaignEcommerceFilters.ts (envio de e-mails no servidor). Manter iguais.
export type EcomRecency = "le_30" | "le_90" | "le_180" | "le_365" | "gt_90" | "gt_180" | "gt_365";

export interface EcommerceFormState {
  cliente: string;          // all | yes | no
  produtos: string[];       // comprou ao menos um destes
  pedidosMin: string;
  gastoMin: string;
  gastoMax: string;
  ultimaCompra: string;     // any | EcomRecency
  primeiraCompra: string;   // any | le_30 | le_90 | le_180 | le_365
  status: string;           // all | status do último pedido
  pagamento: string;        // all | forma de pagamento
  cupom: string;            // all | any | none | <código>
  tipoPessoa: string;       // all | PF | PJ
}

export const EMPTY_ECOMMERCE_FORM: EcommerceFormState = {
  cliente: "all", produtos: [], pedidosMin: "", gastoMin: "", gastoMax: "",
  ultimaCompra: "any", primeiraCompra: "any", status: "all", pagamento: "all",
  cupom: "all", tipoPessoa: "all",
};

const RECENCY_RE = /^(le|gt)_(\d+)$/;

const num = (v: string): number | null => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Estado da tela → chaves gravadas em lead_filter / segmentações salvas. */
export function ecommerceFormToFilters(s: EcommerceFormState): Record<string, any> {
  const f: Record<string, any> = {};
  if (s.cliente === "yes" || s.cliente === "no") f.ecom_cliente = s.cliente;
  const produtos = (s.produtos || []).map((p) => p.trim()).filter(Boolean);
  if (produtos.length) f.ecom_produtos = produtos;
  const pedidos = num(s.pedidosMin); if (pedidos != null) f.ecom_pedidos_min = Math.floor(pedidos);
  const gMin = num(s.gastoMin); if (gMin != null) f.ecom_gasto_min = gMin;
  const gMax = num(s.gastoMax); if (gMax != null) f.ecom_gasto_max = gMax;
  if (RECENCY_RE.test(s.ultimaCompra)) f.ecom_ultima_compra = s.ultimaCompra;
  if (/^le_\d+$/.test(s.primeiraCompra)) f.ecom_primeira_compra = s.primeiraCompra;
  if (s.status && s.status !== "all") f.ecom_status = s.status;
  if (s.pagamento && s.pagamento !== "all") f.ecom_pagamento = s.pagamento;
  if (s.cupom && s.cupom !== "all") f.ecom_cupom = s.cupom;
  if (s.tipoPessoa === "PF" || s.tipoPessoa === "PJ") f.ecom_tipo_pessoa = s.tipoPessoa;
  return f;
}

/** Segmentação salva → estado da tela. */
export function ecommerceFiltersToForm(f: Record<string, any> | null | undefined): EcommerceFormState {
  const x = f || {};
  return {
    cliente: x.ecom_cliente ?? "all",
    produtos: Array.isArray(x.ecom_produtos) ? x.ecom_produtos.map(String) : [],
    pedidosMin: x.ecom_pedidos_min != null ? String(x.ecom_pedidos_min) : "",
    gastoMin: x.ecom_gasto_min != null ? String(x.ecom_gasto_min) : "",
    gastoMax: x.ecom_gasto_max != null ? String(x.ecom_gasto_max) : "",
    ultimaCompra: x.ecom_ultima_compra ?? "any",
    primeiraCompra: x.ecom_primeira_compra ?? "any",
    status: x.ecom_status ?? "all",
    pagamento: x.ecom_pagamento ?? "all",
    cupom: x.ecom_cupom ?? "all",
    tipoPessoa: x.ecom_tipo_pessoa ?? "all",
  };
}

const daysAgoIso = (days: number, now: number) => new Date(now - days * 86400000).toISOString();

/** Aplica as chaves ecom_* numa query de lia_attendances (supabase-js / PostgREST). */
export function applyEcommerceFilters(q: any, f: Record<string, any>, now: number = Date.now()): any {
  if (!f) return q;
  if (f.ecom_cliente === "yes") {
    q = q.or("lojaintegrada_total_pedidos_pagos.gt.0,lojaintegrada_ltv.gt.0,lojaintegrada_ultimo_pedido_data.not.is.null");
  }
  if (f.ecom_cliente === "no") {
    q = q.is("lojaintegrada_ultimo_pedido_data", null)
      .or("lojaintegrada_total_pedidos_pagos.is.null,lojaintegrada_total_pedidos_pagos.eq.0")
      .or("lojaintegrada_ltv.is.null,lojaintegrada_ltv.eq.0");
  }
  if (Array.isArray(f.ecom_produtos) && f.ecom_produtos.length) {
    q = q.overlaps("lojaintegrada_produtos_comprados", f.ecom_produtos.map(String));
  }
  if (f.ecom_pedidos_min != null) q = q.gte("lojaintegrada_total_pedidos_pagos", Number(f.ecom_pedidos_min));
  if (f.ecom_gasto_min != null) q = q.gte("lojaintegrada_ltv", Number(f.ecom_gasto_min));
  if (f.ecom_gasto_max != null) q = q.lte("lojaintegrada_ltv", Number(f.ecom_gasto_max));
  const rec = typeof f.ecom_ultima_compra === "string" ? f.ecom_ultima_compra.match(RECENCY_RE) : null;
  if (rec) {
    const since = daysAgoIso(Number(rec[2]), now);
    q = rec[1] === "le"
      ? q.gte("lojaintegrada_ultimo_pedido_data", since)
      : q.lt("lojaintegrada_ultimo_pedido_data", since);
  }
  const first = typeof f.ecom_primeira_compra === "string" ? f.ecom_primeira_compra.match(/^le_(\d+)$/) : null;
  if (first) q = q.gte("lojaintegrada_primeira_compra", daysAgoIso(Number(first[1]), now));
  if (f.ecom_status) q = q.eq("lojaintegrada_ultimo_pedido_status", f.ecom_status);
  if (f.ecom_pagamento) q = q.eq("lojaintegrada_forma_pagamento", f.ecom_pagamento);
  if (f.ecom_cupom === "any") q = q.not("lojaintegrada_cupom_desconto", "is", null);
  else if (f.ecom_cupom === "none") q = q.is("lojaintegrada_cupom_desconto", null);
  else if (f.ecom_cupom) q = q.eq("lojaintegrada_cupom_desconto", f.ecom_cupom);
  if (f.ecom_tipo_pessoa) q = q.eq("lojaintegrada_tipo_pessoa", f.ecom_tipo_pessoa);
  return q;
}

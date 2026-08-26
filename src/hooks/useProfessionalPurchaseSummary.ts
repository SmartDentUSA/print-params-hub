import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resumo REAL de compras de um profissional/lead.
 *
 * Regra de receita (memória do projeto):
 *   total = Max(CRM_Ganho, Omie_Faturamento) + LTV_Ecommerce
 *
 * Nº de compras = negócios ganhos no CRM + pedidos válidos da Loja Integrada
 * (itens de qualificação NUNCA contam como compra).
 */
export type PurchaseSummary = {
  totalInvested: number;
  crmWonTotal: number;
  omieTotal: number;
  ecomTotal: number;
  purchaseCount: number;
  lastPurchaseDate: string | null;
  lastPurchaseName: string | null;
  lastPurchaseVendor: string | null;
  firstPurchaseDate: string | null;
};

export const EMPTY_SUMMARY: PurchaseSummary = {
  totalInvested: 0,
  crmWonTotal: 0,
  omieTotal: 0,
  ecomTotal: 0,
  purchaseCount: 0,
  lastPurchaseDate: null,
  lastPurchaseName: null,
  lastPurchaseVendor: null,
  firstPurchaseDate: null,
};

const CANCELLED = ["cancelado", "cancelled", "estornado", "reprovado"];

export async function fetchPurchaseSummaries(leadIds: string[]): Promise<Record<string, PurchaseSummary>> {
  const out: Record<string, PurchaseSummary> = {};
  if (leadIds.length === 0) return out;
  for (const id of leadIds) out[id] = { ...EMPTY_SUMMARY };

  // 1) Negócios ganhos do CRM
  const { data: wonDeals } = await supabase
    .from("deals")
    .select("id, lead_id, piperun_deal_id, owner_name, closed_at, value, title")
    .in("lead_id", leadIds)
    .eq("status", "ganha");

  const dealByPipe = new Map<string, any>();
  for (const d of (wonDeals ?? []) as any[]) {
    const s = out[d.lead_id];
    if (!s) continue;
    s.purchaseCount += 1;
    if (d.piperun_deal_id != null) dealByPipe.set(String(d.piperun_deal_id), d);
    const dt: string | null = d.closed_at ?? null;
    if (dt) {
      if (!s.lastPurchaseDate || dt > s.lastPurchaseDate) {
        s.lastPurchaseDate = dt;
        s.lastPurchaseName = d.title ?? null;
        s.lastPurchaseVendor = d.owner_name ?? null;
      }
      if (!s.firstPurchaseDate || dt < s.firstPurchaseDate) s.firstPurchaseDate = dt;
    }
  }

  // Valor: preferir soma dos itens da proposta; fallback para deals.value
  const pipeIds = Array.from(dealByPipe.keys());
  const itemsSumByLead: Record<string, number> = {};
  if (pipeIds.length > 0) {
    const { data: items } = await supabase
      .from("deal_items")
      .select("deal_id, total_value")
      .in("deal_id", pipeIds);
    for (const it of (items ?? []) as any[]) {
      const d = dealByPipe.get(String(it.deal_id));
      if (!d) continue;
      itemsSumByLead[d.lead_id] = (itemsSumByLead[d.lead_id] ?? 0) + (Number(it.total_value) || 0);
    }
  }
  const dealValueByLead: Record<string, number> = {};
  for (const d of (wonDeals ?? []) as any[]) {
    dealValueByLead[d.lead_id] = (dealValueByLead[d.lead_id] ?? 0) + (Number(d.value) || 0);
  }
  for (const id of leadIds) {
    out[id].crmWonTotal = Math.max(itemsSumByLead[id] ?? 0, dealValueByLead[id] ?? 0);
  }

  // 2) Pedidos da Loja Integrada
  const { data: orders } = await supabase
    .from("loja_integrada_orders")
    .select("id, attendance_id, data_pedido, status, valor_total, numero_pedido")
    .in("attendance_id", leadIds);
  for (const o of (orders ?? []) as any[]) {
    if (CANCELLED.includes((o.status || "").toLowerCase())) continue;
    const s = out[o.attendance_id];
    if (!s) continue;
    s.ecomTotal += Number(o.valor_total) || 0;
    s.purchaseCount += 1;
    const dt: string | null = o.data_pedido ?? null;
    if (dt) {
      if (!s.lastPurchaseDate || dt > s.lastPurchaseDate) {
        s.lastPurchaseDate = dt;
        s.lastPurchaseName = o.numero_pedido ? `Pedido #${o.numero_pedido} (e-commerce)` : "Pedido e-commerce";
        s.lastPurchaseVendor = "E-commerce";
      }
      if (!s.firstPurchaseDate || dt < s.firstPurchaseDate) s.firstPurchaseDate = dt;
    }
  }

  // 3) ERP Omie + LTV e-commerce consolidado
  const { data: leads } = await supabase
    .from("lia_attendances")
    .select("id, omie_faturamento_total, omie_ultima_compra, lojaintegrada_ltv")
    .in("id", leadIds);
  for (const l of (leads ?? []) as any[]) {
    const s = out[l.id];
    if (!s) continue;
    s.omieTotal = Number(l.omie_faturamento_total) || 0;
    const ltv = Number(l.lojaintegrada_ltv) || 0;
    if (ltv > s.ecomTotal) s.ecomTotal = ltv;
    if (l.omie_ultima_compra && (!s.lastPurchaseDate || l.omie_ultima_compra > s.lastPurchaseDate)) {
      s.lastPurchaseDate = l.omie_ultima_compra;
      if (!s.lastPurchaseName) s.lastPurchaseName = "Faturamento ERP (Omie)";
    }
  }

  for (const id of leadIds) {
    const s = out[id];
    s.totalInvested = Math.max(s.crmWonTotal, s.omieTotal) + s.ecomTotal;
  }
  return out;
}

export function useProfessionalPurchaseSummary(leadId: string | null, refreshKey = 0) {
  const [summary, setSummary] = useState<PurchaseSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const map = await fetchPurchaseSummaries([leadId]);
        if (!cancelled) setSummary(map[leadId] ?? EMPTY_SUMMARY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshKey]);

  return { summary, loading };
}

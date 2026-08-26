import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface KolFormPerformance {
  form_id: string;
  form_name: string;
  leads: number;
  deals_ganhos: number;
  conversao: number; // 0..1
  receita: number;
}

export interface KolCouponPerformance {
  cupom: string;
  vendas: number;
  receita: number;
  active_from?: string | null;
  active_to?: string | null;
}

export interface KolCouponRule {
  code: string;
  active_from?: string | null;
  active_to?: string | null;
}

export interface KolPerformance {
  forms: KolFormPerformance[];
  coupons: KolCouponPerformance[];
  totals: { leads: number; deals: number; receita: number; receitaCupons: number; vendasCupons: number };
}

const empty: KolPerformance = {
  forms: [],
  coupons: [],
  totals: { leads: 0, deals: 0, receita: 0, receitaCupons: 0, vendasCupons: 0 },
};

/**
 * Performance comercial do KOL:
 * - leads gerados pelos formulários de indicação (respostas de formulário do Sistema B)
 * - conversão = leads com negócio ganho / leads gerados
 * - receita = soma dos negócios ganhos desses leads
 * - cupons: vendas e receita da Loja Integrada com o cupom do KOL
 */
export function useKolPerformance(formIds: { id: string; name: string }[], coupons: KolCouponRule[]) {
  const [data, setData] = useState<KolPerformance>(empty);
  const [loading, setLoading] = useState(false);

  const ids = formIds.map((f) => f.id).filter(Boolean);
  const rules = (coupons ?? [])
    .map((c) => ({ ...c, code: (c.code || "").trim().toUpperCase() }))
    .filter((c) => c.code);
  const key = `${ids.slice().sort().join(",")}|${rules
    .map((c) => `${c.code}:${c.active_from ?? ""}:${c.active_to ?? ""}`)
    .sort()
    .join(",")}`;

  const load = useCallback(async () => {
    if (ids.length === 0 && rules.length === 0) {
      setData(empty);
      return;
    }
    setLoading(true);
    try {
      const forms: KolFormPerformance[] = [];
      let leadsByForm: Record<string, Set<string>> = {};

      if (ids.length > 0) {
        const { data: resp } = await (supabase as any)
          .from("smartops_form_field_responses")
          .select("lead_id, form_id")
          .in("form_id", ids)
          .not("lead_id", "is", null)
          .limit(20000);

        for (const r of (resp ?? []) as any[]) {
          leadsByForm[r.form_id] ??= new Set<string>();
          leadsByForm[r.form_id].add(r.lead_id);
        }

        const allLeads = Array.from(new Set(Object.values(leadsByForm).flatMap((s) => Array.from(s))));

        // Negócios ganhos dos leads indicados
        const wonByLead: Record<string, number> = {};
        for (let i = 0; i < allLeads.length; i += 300) {
          const chunk = allLeads.slice(i, i + 300);
          const { data: deals } = await (supabase as any)
            .from("deals")
            .select("lead_id, value, status, is_deleted")
            .in("lead_id", chunk)
            .eq("status", "ganha");
          for (const d of (deals ?? []) as any[]) {
            if (d.is_deleted) continue;
            wonByLead[d.lead_id] = (wonByLead[d.lead_id] ?? 0) + Number(d.value ?? 0);
          }
        }

        for (const f of formIds) {
          const leadSet = leadsByForm[f.id] ?? new Set<string>();
          const won = Array.from(leadSet).filter((l) => wonByLead[l] !== undefined);
          const receita = won.reduce((s, l) => s + (wonByLead[l] ?? 0), 0);
          forms.push({
            form_id: f.id,
            form_name: f.name,
            leads: leadSet.size,
            deals_ganhos: won.length,
            conversao: leadSet.size > 0 ? won.length / leadSet.size : 0,
            receita,
          });
        }
      }

      const couponsPerf: KolCouponPerformance[] = [];
      for (const rule of rules) {
        let q = (supabase as any)
          .from("loja_integrada_orders")
          .select("valor_total, cupom_codigo, data_pedido")
          .ilike("cupom_codigo", rule.code)
          .limit(5000);
        if (rule.active_from) q = q.gte("data_pedido", rule.active_from);
        if (rule.active_to) q = q.lte("data_pedido", `${rule.active_to}T23:59:59`);
        const { data: orders } = await q;
        const rows = (orders ?? []) as any[];
        couponsPerf.push({
          cupom: rule.code,
          active_from: rule.active_from ?? null,
          active_to: rule.active_to ?? null,
          vendas: rows.length,
          receita: rows.reduce((s, o) => s + Number(o.valor_total ?? 0), 0),
        });
      }
      const coupons = couponsPerf;

      setData({
        forms,
        coupons,
        totals: {
          leads: forms.reduce((s, f) => s + f.leads, 0),
          deals: forms.reduce((s, f) => s + f.deals_ganhos, 0),
          receita: forms.reduce((s, f) => s + f.receita, 0),
          vendasCupons: coupons.reduce((s, c) => s + c.vendas, 0),
          receitaCupons: coupons.reduce((s, c) => s + c.receita, 0),
        },
      });
    } catch {
      setData(empty);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...data, loading, reload: load };
}

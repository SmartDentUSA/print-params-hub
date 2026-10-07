import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface KolFormPerformance {
  form_id: string;
  form_name: string;
  leads: number;
  deals_ganhos: number;
  conversao: number; // 0..1
  receita: number;
  /** Comissão calculada pelas regras por produto (itens dos negócios ganhos). null = sem regra aplicável. */
  comissao: number | null;
  views: number;
  visitors: number;
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
  commission_percent?: number | null;
}

export interface KolProductRule {
  product_name: string;
  percent: number | null;
  active_from: string | null;
}

const norm = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface KolPerformance {
  forms: KolFormPerformance[];
  coupons: KolCouponPerformance[];
  totals: { leads: number; deals: number; receita: number; receitaCupons: number; vendasCupons: number; views: number; visitors: number; cuponsGerados: number; clientesCupons: number };
}

const empty: KolPerformance = {
  forms: [],
  coupons: [],
  totals: { leads: 0, deals: 0, receita: 0, receitaCupons: 0, vendasCupons: 0, views: 0, visitors: 0, cuponsGerados: 0, clientesCupons: 0 },
};

/**
 * Performance comercial do KOL:
 * - leads gerados pelos formulários de indicação (respostas de formulário do Sistema B)
 * - conversão = leads com negócio ganho / leads gerados
 * - receita = soma dos negócios ganhos desses leads
 * - cupons: vendas e receita da Loja Integrada com o cupom do KOL
 */
export function useKolPerformance(formIds: { id: string; name: string }[], coupons: KolCouponRule[], productRules: KolProductRule[] = []) {
  const [data, setData] = useState<KolPerformance>(empty);
  const [loading, setLoading] = useState(false);

  const ids = formIds.map((f) => f.id).filter(Boolean);
  const rules = (coupons ?? [])
    .map((c) => ({ ...c, code: (c.code || "").trim().toUpperCase() }))
    .filter((c) => c.code);
  const key = `${ids.slice().sort().join(",")}|${rules
    .map((c) => `${c.code}:${c.active_from ?? ""}:${c.active_to ?? ""}`)
    .sort()
    .join(",")}|${productRules.map((r) => `${r.product_name}:${r.percent}:${r.active_from}`).join(",")}`;
  const prules = productRules
    .filter((r) => r.product_name && r.percent != null)
    .map((r) => ({ key: norm(r.product_name), pct: Number(r.percent), from: r.active_from ? String(r.active_from).slice(0, 10) : null }));
  const fallbackPct = rules.find((c) => c.commission_percent != null)?.commission_percent ?? null;

  const load = useCallback(async () => {
    if (ids.length === 0 && rules.length === 0) {
      setData(empty);
      return;
    }
    setLoading(true);
    try {
      const forms: KolFormPerformance[] = [];
      const leadsByForm: Record<string, Set<string>> = {};

      if (ids.length > 0) {
        // 1) Respostas de campos personalizados (só existem quando o formulário tem perguntas extras)
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

        // 2) Fonte principal: leads gravados com o nome do formulário (form_name em lia_attendances).
        //    Formulários sem perguntas extras não geram respostas de campo, então esta é a contagem real.
        const { data: formRows } = await (supabase as any)
          .from("smartops_forms")
          .select("id, name, slug")
          .in("id", ids);

        const nameById = new Map<string, string[]>();
        for (const f of (formRows ?? []) as any[]) {
          nameById.set(f.id, [f.name, f.slug].filter(Boolean));
        }
        const allNames = Array.from(nameById.values()).flat();
        const slugById = new Map<string, string>();
        for (const f of (formRows ?? []) as any[]) if (f.slug) slugById.set(f.id, f.slug);
        const viewsBySlug: Record<string, { views: number; visitors: number }> = {};
        if (slugById.size > 0) {
          const { data: vRows } = await (supabase as any).rpc("fn_kol_form_views", { _slugs: Array.from(slugById.values()) });
          for (const r of (vRows ?? []) as any[]) viewsBySlug[r.slug] = { views: Number(r.views) || 0, visitors: Number(r.visitors) || 0 };
        }
        (leadsByForm as any).__views = { slugById, viewsBySlug };

        if (allNames.length > 0) {
          // 3) Fonte definitiva: RPC que casa form_name OU a chave do formulário dentro de form_data
          //    (o lead pode ter respondido outros formulários depois, ou ter sido unificado).
          const { data: rpcRows } = await (supabase as any).rpc("fn_kol_form_leads", {
            _names: allNames,
          });

          for (const r of (rpcRows ?? []) as any[]) {
            for (const [formId, names] of nameById.entries()) {
              if (names.includes(r.form_key)) {
                leadsByForm[formId] ??= new Set<string>();
                leadsByForm[formId].add(r.lead_id);
              }
            }
          }
        }


        const allLeads = Array.from(new Set(Object.values(leadsByForm).flatMap((s) => Array.from(s))));

        // Negócios ganhos dos leads indicados
        const wonByLead: Record<string, number> = {};
        const commByLead: Record<string, number> = {};
        for (let i = 0; i < allLeads.length; i += 300) {
          const chunk = allLeads.slice(i, i + 300);
          const { data: deals } = await (supabase as any)
            .from("deals")
            .select("id, piperun_deal_id, lead_id, value, status, is_deleted, closed_at")
            .in("lead_id", chunk)
            .eq("status", "ganha");
          const won = ((deals ?? []) as any[]).filter((d) => !d.is_deleted);
          for (const d of won) {
            wonByLead[d.lead_id] = (wonByLead[d.lead_id] ?? 0) + Number(d.value ?? 0);
          }
          if (prules.length === 0 && fallbackPct == null) continue;
          // Itens das propostas dos negócios ganhos → regra por produto (respeitando a data de ativação)
          const dealIds = new Set<string>();
          const dealDate: Record<string, string | null> = {};
          for (const d of won) {
            for (const k of [d.id, d.piperun_deal_id].filter(Boolean).map(String)) {
              dealIds.add(k);
              dealDate[k] = d.closed_at ? String(d.closed_at).slice(0, 10) : null;
            }
          }
          const covered = new Set<string>();
          if (dealIds.size > 0) {
            const { data: items } = await (supabase as any)
              .from("deal_items")
              .select("deal_id, lead_id, product_name, nome_produto, total_value, valor_total, deal_date, parent_deal_item_id")
              .in("lead_id", chunk)
              .limit(20000);
            for (const it of (items ?? []) as any[]) {
              const did = it.deal_id ? String(it.deal_id) : "";
              if (!dealIds.has(did) || it.parent_deal_item_id) continue;
              covered.add(did);
              const name = norm(it.product_name || it.nome_produto);
              const date = dealDate[did] ?? (it.deal_date ? String(it.deal_date).slice(0, 10) : null);
              const val = Number(it.total_value ?? it.valor_total ?? 0);
              const rule = prules
                .filter((r) => r.key && (name === r.key || name.includes(r.key) || r.key.includes(name)))
                .filter((r) => !r.from || !date || date >= r.from)
                .sort((a, b) => b.key.length - a.key.length)[0];
              const pct = rule ? rule.pct : fallbackPct;
              if (pct != null) commByLead[it.lead_id] = (commByLead[it.lead_id] ?? 0) + (val * pct) / 100;
            }
          }
          // Negócios ganhos sem itens de proposta: usa a % geral do KOL sobre o valor do negócio
          if (fallbackPct != null) {
            for (const d of won) {
              const hit = [d.id, d.piperun_deal_id].filter(Boolean).some((k) => covered.has(String(k)));
              if (!hit) commByLead[d.lead_id] = (commByLead[d.lead_id] ?? 0) + (Number(d.value ?? 0) * fallbackPct) / 100;
            }
          }
        }

        for (const f of formIds) {
          const leadSet = leadsByForm[f.id] ?? new Set<string>();
          const won = Array.from(leadSet).filter((l) => wonByLead[l] !== undefined);
          const receita = won.reduce((s, l) => s + (wonByLead[l] ?? 0), 0);
          const hasRules = prules.length > 0 || fallbackPct != null;
          const comissao = hasRules ? won.reduce((s, l) => s + (commByLead[l] ?? 0), 0) : null;
          const vinfo = (leadsByForm as any).__views;
          const vv = vinfo?.viewsBySlug?.[vinfo?.slugById?.get(f.id)] ?? { views: 0, visitors: 0 };
          forms.push({
            views: vv.views,
            visitors: vv.visitors,
            form_id: f.id,
            form_name: f.name,
            leads: leadSet.size,
            deals_ganhos: won.length,
            conversao: leadSet.size > 0 ? won.length / leadSet.size : 0,
            receita,
            comissao,
          });
        }
      }


      const couponsPerf: KolCouponPerformance[] = [];
      for (const rule of rules) {
        // Pedidos da loja só são legíveis no servidor: consulta agregada (cancelados excluídos)
        const { data: cRows } = await (supabase as any).rpc("fn_kol_coupon_sales", {
          _code: rule.code,
          _from: rule.active_from ? String(rule.active_from).slice(0, 10) : null,
          _to: rule.active_to ? String(rule.active_to).slice(0, 10) : null,
        });
        const r0 = ((cRows ?? []) as any[])[0] ?? {};
        couponsPerf.push({
          cupom: rule.code,
          active_from: rule.active_from ?? null,
          active_to: rule.active_to ?? null,
          vendas: Number(r0.vendas) || 0,
          receita: Number(r0.receita) || 0,
          clientes: Number(r0.clientes) || 0,
        } as any);
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
          views: forms.reduce((s, f) => s + f.views, 0),
          visitors: forms.reduce((s, f) => s + f.visitors, 0),
          cuponsGerados: rules.length,
          clientesCupons: coupons.reduce((s, c: any) => s + (c.clientes || 0), 0),
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

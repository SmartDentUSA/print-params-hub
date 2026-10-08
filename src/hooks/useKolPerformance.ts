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
  daily_series: Array<{ d: string; v: number }>;
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
  kind?: "product" | "category";
  category?: string | null;
  subcategory?: string | null;
  product_name: string;
  percent: number | null;
  active_from: string | null;
}

const norm = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface KolSoldProduct {
  produto: string;
  categoria: string | null;
  subcategoria: string | null;
  origem: "formulario" | "cupom";
  quantidade: number;
  valor: number;
  comissao: number | null;
}

export interface KolPerformance {
  products: KolSoldProduct[];
  forms: KolFormPerformance[];
  coupons: KolCouponPerformance[];
  totals: {
    leads: number;
    deals: number;
    receita: number;
    receitaCupons: number;
    vendasCupons: number;
    views: number;
    visitors: number;
    daily_series: Array<{ d: string; v: number }>;
    cuponsGerados: number;
    clientesCupons: number;
    /** Comissão total (leads + cupons) pelas regras do KOL. null = nenhuma regra cadastrada. */
    comissao: number | null;
    comissaoLeads: number;
    comissaoCupons: number;
  };
}

const empty: KolPerformance = {
  products: [],
  forms: [],
  coupons: [],
  totals: { leads: 0, deals: 0, receita: 0, receitaCupons: 0, vendasCupons: 0, views: 0, visitors: 0, daily_series: [], cuponsGerados: 0, clientesCupons: 0 },
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
    .join(",")}|${productRules.map((r) => `${r.kind ?? "p"}:${r.category ?? ""}:${r.subcategory ?? ""}:${r.product_name}:${r.percent}:${r.active_from}`).join(",")}`;
  const prules = productRules
    .filter((r) => r.kind !== "category" && r.product_name && r.percent != null)
    .map((r) => ({ key: norm(r.product_name), pct: Number(r.percent), from: r.active_from ? String(r.active_from).slice(0, 10) : null }));
  const crules = productRules
    .filter((r) => r.kind === "category" && r.category && r.percent != null)
    .map((r) => ({ cat: norm(r.category), sub: r.subcategory ? norm(r.subcategory) : null, pct: Number(r.percent), from: r.active_from ? String(r.active_from).slice(0, 10) : null }));
  const fallbackPct = rules.find((c) => c.commission_percent != null)?.commission_percent ?? null;

  const load = useCallback(async () => {
    if (ids.length === 0 && rules.length === 0) {
      setData(empty);
      return;
    }
    setLoading(true);
    try {
      // Portfólio: nome do produto → categoria/subcategoria
      const catalog = new Map<string, { cat: string | null; sub: string | null }>();
      const { data: catRows } = await (supabase as any)
        .from("system_a_catalog")
        .select("name, product_category, product_subcategory")
        .not("product_category", "is", null)
        .limit(2000);
      for (const c of (catRows ?? []) as any[]) catalog.set(norm(c.name), { cat: c.product_category, sub: c.product_subcategory });
      // Mapeamento já existente (combos e portfólio): produto_aliases leva a
      // variante vendida ao nome canônico com categoria/subcategoria.
      const aliases = new Map<string, { canonical: string; cat: string | null; sub: string | null }>();
      const { data: aliasRows } = await (supabase as any)
        .from("produto_aliases")
        .select("nome_variante, nome_canonico, categoria, subcategoria")
        .eq("ativo", true)
        .limit(5000);
      for (const a of (aliasRows ?? []) as any[]) {
        if (a.nome_variante) aliases.set(norm(a.nome_variante), { canonical: a.nome_canonico || "", cat: a.categoria ?? null, sub: a.subcategoria ?? null });
      }
      const classify = (rawName: string, cat?: string | null, sub?: string | null) => {
        const n = norm(rawName);
        // 1) alias exato (mapeamento manual de combos/portfólio)
        const alias = aliases.get(n);
        if (alias) {
          const catHit = alias.canonical ? catalog.get(norm(alias.canonical)) : undefined;
          return { cat: alias.cat ?? catHit?.cat ?? cat ?? null, sub: alias.sub ?? catHit?.sub ?? sub ?? null };
        }
        // 2) catálogo por nome exato normalizado
        let hit = catalog.get(n);
        // 3) catálogo por contenção (padrão mais longo vence)
        if (!hit) {
          let best = "";
          for (const k of catalog.keys()) if (k.length > best.length && k.length >= 5 && (n.includes(k) || k.includes(n))) best = k;
          if (best) hit = catalog.get(best);
        }
        // 4) alias por contenção
        if (!hit) {
          let best = "";
          for (const k of aliases.keys()) if (k.length > best.length && k.length >= 5 && (n.includes(k) || k.includes(n))) best = k;
          if (best) {
            const a = aliases.get(best)!;
            const catHit = a.canonical ? catalog.get(norm(a.canonical)) : undefined;
            return { cat: a.cat ?? catHit?.cat ?? cat ?? null, sub: a.sub ?? catHit?.sub ?? sub ?? null };
          }
        }
        return { cat: hit?.cat ?? cat ?? null, sub: hit?.sub ?? sub ?? null };
      };
      const pctFor = (rawName: string, cat: string | null, sub: string | null, date: string | null, fb: number | null) => {
        const name = norm(rawName);
        const okDate = (from: string | null) => !from || !date || date >= from;
        const pr = prules
          .filter((r) => r.key && (name === r.key || name.includes(r.key) || r.key.includes(name)) && okDate(r.from))
          .sort((a, b) => b.key.length - a.key.length)[0];
        if (pr) return pr.pct;
        const nc = norm(cat), ns = norm(sub);
        const sr = crules.find((r) => r.sub && r.cat === nc && r.sub === ns && okDate(r.from));
        if (sr) return sr.pct;
        const cr = crules.find((r) => !r.sub && r.cat === nc && okDate(r.from));
        if (cr) return cr.pct;
        return fb;
      };
      const sold = new Map<string, KolSoldProduct>();
      const addSold = (origem: "formulario" | "cupom", produto: string, cat: string | null, sub: string | null, qtd: number, valor: number, com: number | null) => {
        const k = `${origem}|${norm(produto)}`;
        const cur = sold.get(k) ?? { produto, categoria: cat, subcategoria: sub, origem, quantidade: 0, valor: 0, comissao: null };
        cur.quantidade += qtd;
        cur.valor += valor;
        if (com != null) cur.comissao = (cur.comissao ?? 0) + com;
        sold.set(k, cur);
      };
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
        const dailyByForm = new Map<string, Array<{ d: string; v: number }>>();
        if (slugById.size > 0) {
          const [{ data: vRows }, { data: metricRows }] = await Promise.all([
            (supabase as any).rpc("fn_kol_form_views", { _slugs: Array.from(slugById.values()) }),
            (supabase as any).rpc("fn_form_metrics", { p_period_days: 30 }),
          ]);
          for (const r of (vRows ?? []) as any[]) viewsBySlug[r.slug] = { views: Number(r.views) || 0, visitors: Number(r.visitors) || 0 };
          const wantedIds = new Set(ids);
          for (const r of (metricRows ?? []) as any[]) {
            if (!wantedIds.has(r.form_id)) continue;
            dailyByForm.set(
              r.form_id,
              (Array.isArray(r.daily_series) ? r.daily_series : []).map((p: any) => ({ d: String(p.d), v: Number(p.v) || 0 })),
            );
          }
        }
        (leadsByForm as any).__views = { slugById, viewsBySlug, dailyByForm };

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
              .select("deal_id, lead_id, product_name, nome_produto, total_value, valor_total, quantity, quantidade, deal_date, parent_deal_item_id, product_category, product_subcategory")
              .in("lead_id", chunk)
              .limit(20000);
            for (const it of (items ?? []) as any[]) {
              const did = it.deal_id ? String(it.deal_id) : "";
              if (!dealIds.has(did) || it.parent_deal_item_id) continue;
              covered.add(did);
              const name = norm(it.product_name || it.nome_produto);
              const date = dealDate[did] ?? (it.deal_date ? String(it.deal_date).slice(0, 10) : null);
              const val = Number(it.total_value ?? it.valor_total ?? 0);
              void name;
              const raw = it.product_name || it.nome_produto || "(sem nome)";
              const c = classify(raw, it.product_category, it.product_subcategory);
              const pct = pctFor(raw, c.cat, c.sub, date, fallbackPct);
              const com = pct != null ? (val * pct) / 100 : null;
              if (com != null) commByLead[it.lead_id] = (commByLead[it.lead_id] ?? 0) + com;
              addSold("formulario", raw, c.cat, c.sub, Number(it.quantity ?? it.quantidade ?? 1) || 1, val, com);
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
          const hasRules = prules.length > 0 || crules.length > 0 || fallbackPct != null;
          const comissao = hasRules ? won.reduce((s, l) => s + (commByLead[l] ?? 0), 0) : null;
          const vinfo = (leadsByForm as any).__views;
          const vv = vinfo?.viewsBySlug?.[vinfo?.slugById?.get(f.id)] ?? { views: 0, visitors: 0 };
          forms.push({
            views: vv.views,
            visitors: vv.visitors,
            daily_series: vinfo?.dailyByForm?.get(f.id) ?? [],
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
        const { data: iRows } = await (supabase as any).rpc("fn_kol_coupon_items", {
          _code: rule.code,
          _from: rule.active_from ? String(rule.active_from).slice(0, 10) : null,
          _to: rule.active_to ? String(rule.active_to).slice(0, 10) : null,
        });
        for (const it of (iRows ?? []) as any[]) {
          const raw = it.produto || "(sem nome)";
          const c = classify(raw);
          const val = Number(it.valor) || 0;
          const pct = pctFor(raw, c.cat, c.sub, it.data_pedido ? String(it.data_pedido).slice(0, 10) : null, rule.commission_percent ?? null);
          addSold("cupom", raw, c.cat, c.sub, Number(it.quantidade) || 1, val, pct != null ? (val * pct) / 100 : null);
        }
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

      const dailyTotals = new Map<string, number>();
      for (const form of forms) {
        for (const point of form.daily_series) dailyTotals.set(point.d, (dailyTotals.get(point.d) ?? 0) + point.v);
      }

      setData({
        products: Array.from(sold.values()).sort((a, b) => b.valor - a.valor),
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
          daily_series: Array.from(dailyTotals, ([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d)),
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

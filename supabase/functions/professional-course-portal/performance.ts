// Performance do KOL no portal: mesma lógica da ficha do profissional no SmartOps
// (useKolPerformance), executada server-side com filtro opcional de período (from/to).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const norm = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

interface KolFormPerformance {
  form_id: string;
  form_name: string;
  leads: number;
  deals_ganhos: number;
  conversao: number;
  receita: number;
  comissao: number | null;
  views: number;
  visitors: number;
  daily_series: Array<{ d: string; v: number }>;
}

interface KolSoldProduct {
  produto: string;
  categoria: string | null;
  subcategoria: string | null;
  origem: "formulario" | "cupom";
  quantidade: number;
  valor: number;
  comissao: number | null;
}

export async function kolPerformance(
  admin: SupabaseClient,
  leadId: string,
  from: string | null,
  to: string | null,
) {
  const { data: lead } = await admin.from("lia_attendances")
    .select("prof_kol_form_ids, prof_kol_coupons, prof_kol_coupon, prof_kol_commissions")
    .eq("id", leadId).maybeSingle();

  const formRefs: { id: string; name: string }[] = Array.isArray(lead?.prof_kol_form_ids) ? lead.prof_kol_form_ids : [];
  const couponRules: { code: string; commission_percent?: number | null; active_from?: string | null; active_to?: string | null }[] =
    Array.isArray(lead?.prof_kol_coupons) ? lead.prof_kol_coupons : [];
  if (!couponRules.length && lead?.prof_kol_coupon) couponRules.push({ code: String(lead.prof_kol_coupon).toUpperCase() });
  const rules = couponRules
    .map((c) => ({ ...c, code: (c.code || "").trim().toUpperCase() }))
    .filter((c) => c.code);
  const productRules: any[] = Array.isArray(lead?.prof_kol_commissions) ? lead.prof_kol_commissions : [];

  const prulesAll = productRules
    .filter((r) => r.kind !== "category" && r.product_name && r.percent != null)
    .map((r) => ({ ch: r.channel ?? null, key: norm(r.product_name), pct: Number(r.percent), from: r.active_from ? String(r.active_from).slice(0, 10) : null }));
  const crulesAll = productRules
    .filter((r) => r.kind === "category" && r.category && r.percent != null)
    .map((r) => ({ ch: r.channel ?? null, cat: norm(r.category), sub: r.subcategory ? norm(r.subcategory) : null, pct: Number(r.percent), from: r.active_from ? String(r.active_from).slice(0, 10) : null }));
  const fallbackPct = rules.find((c) => c.commission_percent != null)?.commission_percent ?? null;

  // Catálogo e aliases para classificar produtos vendidos
  const catalog = new Map<string, { cat: string | null; sub: string | null }>();
  const { data: catRows } = await admin.from("system_a_catalog")
    .select("name, product_category, product_subcategory")
    .not("product_category", "is", null).limit(2000);
  for (const c of catRows ?? []) catalog.set(norm(c.name), { cat: c.product_category, sub: c.product_subcategory });
  const aliases = new Map<string, { canonical: string; cat: string | null; sub: string | null }>();
  const { data: aliasRows } = await admin.from("produto_aliases")
    .select("nome_variante, nome_canonico, categoria, subcategoria")
    .eq("ativo", true).limit(5000);
  for (const a of aliasRows ?? []) {
    if (a.nome_variante) aliases.set(norm(a.nome_variante), { canonical: a.nome_canonico || "", cat: a.categoria ?? null, sub: a.subcategoria ?? null });
  }
  const classify = (rawName: string, cat?: string | null, sub?: string | null) => {
    const n = norm(rawName);
    const alias = aliases.get(n);
    if (alias) {
      const catHit = alias.canonical ? catalog.get(norm(alias.canonical)) : undefined;
      return { cat: alias.cat ?? catHit?.cat ?? cat ?? null, sub: alias.sub ?? catHit?.sub ?? sub ?? null };
    }
    let hit = catalog.get(n);
    if (!hit) {
      let best = "";
      for (const k of catalog.keys()) if (k.length > best.length && k.length >= 5 && (n.includes(k) || k.includes(n))) best = k;
      if (best) hit = catalog.get(best);
    }
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
  const pctForCh = (rawName: string, cat: string | null, sub: string | null, date: string | null, fb: number | null, ch: string | null) => {
    const prules = prulesAll.filter((r) => r.ch === ch);
    const crules = crulesAll.filter((r) => r.ch === ch);
    const name = norm(rawName);
    const okDate = (f: string | null) => !f || !date || date >= f;
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
  const pctFor = (rawName: string, cat: string | null, sub: string | null, date: string | null, fb: number | null, ch = "cupom") =>
    pctForCh(rawName, cat, sub, date, null, ch) ?? pctForCh(rawName, cat, sub, date, fb, null);

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
  const inRange = (d: string | null | undefined) => {
    if (!d) return false;
    const day = String(d).slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };

  if (formRefs.length > 0) {
    const formIds = formRefs.map((f) => f.id).filter(Boolean);
    const { data: formRows } = await admin.from("smartops_forms")
      .select("id, name, slug").in("id", formIds);
    const nameById = new Map<string, string[]>();
    for (const f of formRows ?? []) nameById.set(f.id, [f.name, f.slug].filter(Boolean));
    const allNames = Array.from(nameById.values()).flat();

    // Leads por formulário (fn_kol_form_leads casa form_name ou chave em form_data)
    const leadsByForm: Record<string, Set<string>> = {};
    const leadCreated = new Map<string, string>();
    if (allNames.length) {
      const { data: rpcRows } = await admin.rpc("fn_kol_form_leads", { _names: allNames });
      const allLeadIds = [...new Set((rpcRows ?? []).map((r: any) => String(r.lead_id)))];
      if (allLeadIds.length) {
        let q = admin.from("lia_attendances").select("id, created_at").in("id", allLeadIds).is("merged_into", null);
        if (from) q = q.gte("created_at", `${from}T00:00:00-03:00`);
        if (to) q = q.lte("created_at", `${to}T23:59:59-03:00`);
        const { data: leadRows } = await q.limit(5000);
        const allowed = new Set((leadRows ?? []).map((l: any) => String(l.id)));
        for (const l of leadRows ?? []) leadCreated.set(String(l.id), String(l.created_at));
        for (const r of rpcRows ?? []) {
          if (!allowed.has(String(r.lead_id))) continue;
          for (const [formId, names] of nameById.entries()) {
            if (names.includes(r.form_key)) {
              leadsByForm[formId] ??= new Set<string>();
              leadsByForm[formId].add(String(r.lead_id));
            }
          }
        }
      }
    }

    // Visitas por slug (totais — a RPC de views não tem filtro de período)
    const slugById = new Map<string, string>();
    for (const f of formRows ?? []) if (f.slug) slugById.set(f.id, f.slug);
    const viewsBySlug: Record<string, { views: number; visitors: number }> = {};
    const dailyByForm = new Map<string, Array<{ d: string; v: number }>>();
    if (slugById.size > 0) {
      const [{ data: vRows }, { data: metricRows }] = await Promise.all([
        admin.rpc("fn_kol_form_views", { _slugs: Array.from(slugById.values()) }),
        admin.rpc("fn_form_metrics", { p_period_days: 30 }),
      ]);
      for (const r of vRows ?? []) viewsBySlug[r.slug] = { views: Number(r.views) || 0, visitors: Number(r.visitors) || 0 };
      const wantedIds = new Set(formIds);
      for (const r of metricRows ?? []) {
        if (!wantedIds.has(r.form_id)) continue;
        dailyByForm.set(
          r.form_id,
          (Array.isArray(r.daily_series) ? r.daily_series : []).map((p: any) => ({ d: String(p.d), v: Number(p.v) || 0 })),
        );
      }
    }

    const allLeads = Array.from(new Set(Object.values(leadsByForm).flatMap((s) => Array.from(s))));
    const wonByLead: Record<string, number> = {};
    const commByLead: Record<string, number> = {};
    for (let i = 0; i < allLeads.length; i += 300) {
      const chunk = allLeads.slice(i, i + 300);
      const { data: deals } = await admin.from("deals")
        .select("id, piperun_deal_id, lead_id, value, status, is_deleted, closed_at")
        .in("lead_id", chunk).eq("status", "ganha");
      const won = (deals ?? []).filter((d: any) => !d.is_deleted && (!from && !to ? true : inRange(d.closed_at)));
      for (const d of won) wonByLead[d.lead_id] = (wonByLead[d.lead_id] ?? 0) + Number(d.value ?? 0);

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
        const { data: items } = await admin.from("deal_items")
          .select("deal_id, lead_id, product_name, nome_produto, total_value, valor_total, quantity, quantidade, deal_date, parent_deal_item_id, product_category, product_subcategory")
          .in("lead_id", chunk).limit(20000);
        for (const it of items ?? []) {
          const did = it.deal_id ? String(it.deal_id) : "";
          if (!dealIds.has(did) || it.parent_deal_item_id) continue;
          covered.add(did);
          const date = dealDate[did] ?? (it.deal_date ? String(it.deal_date).slice(0, 10) : null);
          const val = Number(it.total_value ?? it.valor_total ?? 0);
          const raw = it.product_name || it.nome_produto || "(sem nome)";
          const c = classify(raw, it.product_category, it.product_subcategory);
          const pct = pctFor(raw, c.cat, c.sub, date, fallbackPct, "formulario");
          const com = pct != null ? (val * pct) / 100 : null;
          if (com != null) commByLead[it.lead_id] = (commByLead[it.lead_id] ?? 0) + com;
          addSold("formulario", raw, c.cat, c.sub, Number(it.quantity ?? it.quantidade ?? 1) || 1, val, com);
        }
      }
      if (fallbackPct != null) {
        for (const d of won) {
          const hit = [d.id, d.piperun_deal_id].filter(Boolean).some((k) => covered.has(String(k)));
          if (!hit) commByLead[d.lead_id] = (commByLead[d.lead_id] ?? 0) + (Number(d.value ?? 0) * fallbackPct) / 100;
        }
      }
    }

    for (const f of formRefs) {
      const leadSet = leadsByForm[f.id] ?? new Set<string>();
      const won = Array.from(leadSet).filter((l) => wonByLead[l] !== undefined);
      const receita = won.reduce((s, l) => s + (wonByLead[l] ?? 0), 0);
      const hasRules = prulesAll.length > 0 || crulesAll.length > 0 || fallbackPct != null;
      const comissao = hasRules ? won.reduce((s, l) => s + (commByLead[l] ?? 0), 0) : null;
      const vv = viewsBySlug[slugById.get(f.id) ?? ""] ?? { views: 0, visitors: 0 };
      forms.push({
        views: vv.views,
        visitors: vv.visitors,
        daily_series: dailyByForm.get(f.id) ?? [],
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

  // Cupons (Loja Integrada) com interseção entre vigência do cupom e período selecionado
  const couponsPerf: any[] = [];
  for (const rule of rules) {
    const ruleFrom = rule.active_from ? String(rule.active_from).slice(0, 10) : null;
    const ruleTo = rule.active_to ? String(rule.active_to).slice(0, 10) : null;
    const effFrom = from && ruleFrom ? (from > ruleFrom ? from : ruleFrom) : (from ?? ruleFrom);
    const effTo = to && ruleTo ? (to < ruleTo ? to : ruleTo) : (to ?? ruleTo);
    const { data: cRows } = await admin.rpc("fn_kol_coupon_sales", { _code: rule.code, _from: effFrom, _to: effTo });
    const r0 = (cRows ?? [])[0] ?? {};
    const { data: iRows } = await admin.rpc("fn_kol_coupon_items", { _code: rule.code, _from: effFrom, _to: effTo });
    for (const it of iRows ?? []) {
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
      commission_percent: rule.commission_percent ?? null,
      vendas: Number(r0.vendas) || 0,
      receita: Number(r0.receita) || 0,
      clientes: Number(r0.clientes) || 0,
    });
  }

  const dailyTotals = new Map<string, number>();
  for (const form of forms) {
    for (const point of form.daily_series) dailyTotals.set(point.d, (dailyTotals.get(point.d) ?? 0) + point.v);
  }
  const comissaoLeads = forms.reduce((s, f) => s + (f.comissao ?? 0), 0);
  const comissaoCupons = couponsPerf.reduce((s, c) => s + (c.commission_percent != null ? (c.receita * c.commission_percent) / 100 : 0), 0);
  const temRegraComissao = prulesAll.length > 0 || crulesAll.length > 0 || fallbackPct != null;

  return {
    products: Array.from(sold.values()).sort((a, b) => b.valor - a.valor),
    forms,
    coupons: couponsPerf,
    totals: {
      leads: forms.reduce((s, f) => s + f.leads, 0),
      deals: forms.reduce((s, f) => s + f.deals_ganhos, 0),
      receita: forms.reduce((s, f) => s + f.receita, 0),
      vendasCupons: couponsPerf.reduce((s, c) => s + c.vendas, 0),
      receitaCupons: couponsPerf.reduce((s, c) => s + c.receita, 0),
      views: forms.reduce((s, f) => s + f.views, 0),
      visitors: forms.reduce((s, f) => s + f.visitors, 0),
      daily_series: Array.from(dailyTotals, ([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d)),
      cuponsGerados: rules.length,
      clientesCupons: couponsPerf.reduce((s, c) => s + (c.clientes || 0), 0),
      comissao: temRegraComissao ? comissaoLeads + comissaoCupons : null,
      comissaoLeads,
      comissaoCupons,
    },
  };
}

// Performance do KOL no portal: mesma lógica da ficha do profissional no SmartOps
// (useKolPerformance), executada server-side com filtro opcional de período (from/to).
//
// Regra de período: leads gerados são contados pela data de criação do lead; vendas
// (formulário ou cupom) são atribuídas pela data do negócio/pedido (closed_at /
// data_pedido). Assim, ao escolher um mês, o usuário vê o que foi vendido naquele
// mês independentemente de quando o lead chegou.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const norm = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const CANCELLED = ["cancelado", "cancelled", "estornado", "reprovado"];

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

interface BuyerFormRow {
  deal_id: string;
  lead_id: string;
  lead_nome: string | null;
  origem: string;
  produto: string | null;
  valor: number;
  comissao: number | null;
  comissao_pct: number | null;
  vendedora: string | null;
  data: string | null;
  data_fechamento: string | null;
}

interface BuyerCouponRow {
  pedido: string;
  lead_nome: string | null;
  origem: string;
  produto: string | null;
  valor: number;
  comissao: number | null;
  cupom: string;
  data: string | null;
}

interface NegotiatingRow {
  deal_id: string;
  lead_id: string;
  lead_nome: string | null;
  lead_telefone: string | null;
  origem: string;
  produto: string | null;
  valor: number;
  etapa: string | null;
}

export async function kolPerformance(
  admin: SupabaseClient,
  leadId: string,
  from: string | null,
  to: string | null,
) {
  const { data: lead } = await admin.from("lia_attendances")
    .select("nome, prof_kol_form_ids, prof_kol_coupons, prof_kol_coupon, prof_kol_commissions")
    .eq("id", leadId).maybeSingle();

  const formRefs: { id: string; name: string }[] = Array.isArray(lead?.prof_kol_form_ids) ? lead.prof_kol_form_ids : [];
  // Nomes normalizados dos formulários do KOL — um negócio só conta como
  // indicação se a ORIGEM do deal for um desses formulários (evita puxar
  // negócios antigos da mesma pessoa com outras origens).
  const formNamesNorm = new Set(formRefs.map((f) => norm(f.name)).filter(Boolean));
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

  const inRange = (d: string | null | undefined) => {
    if (!d) return false;
    const day = String(d).slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };

  const forms: KolFormPerformance[] = [];
  const buyersForms: BuyerFormRow[] = [];
  const negotiating: NegotiatingRow[] = [];

  if (formRefs.length > 0) {
    const formIds = formRefs.map((f) => f.id).filter(Boolean);
    const { data: formRows } = await admin.from("smartops_forms")
      .select("id, name, slug").in("id", formIds);
    const nameById = new Map<string, string[]>();
    for (const f of formRows ?? []) nameById.set(f.id, [f.name, f.slug].filter(Boolean));
    const allNames = Array.from(nameById.values()).flat();

    // Leads por formulário — mesmas fontes da ficha do profissional (useKolPerformance):
    // 1) respostas de campos personalizados; 2) RPC fn_kol_form_leads (form_name,
    //    chave em form_data, histórico de submissões e deals por origem).
    const leadsByForm: Record<string, Set<string>> = {};
    const leadFormName = new Map<string, string>();
    const leadCreated = new Map<string, string>();

    const { data: respRows } = await admin.from("smartops_form_field_responses")
      .select("lead_id, form_id").in("form_id", formIds).not("lead_id", "is", null).limit(20000);
    for (const r of respRows ?? []) {
      if (!r.lead_id) continue;
      leadsByForm[r.form_id] ??= new Set<string>();
      leadsByForm[r.form_id].add(String(r.lead_id));
      if (!leadFormName.has(String(r.lead_id))) {
        leadFormName.set(String(r.lead_id), formRefs.find((f) => f.id === r.form_id)?.name ?? "");
      }
    }

    if (allNames.length) {
      const { data: rpcRows } = await admin.rpc("fn_kol_form_leads", { _names: allNames });
      const allLeadIds = [...new Set((rpcRows ?? []).map((r: any) => String(r.lead_id)))];
      if (allLeadIds.length) {
        const { data: leadRows } = await admin.from("lia_attendances")
          .select("id, created_at").in("id", allLeadIds).is("merged_into", null).limit(5000);
        const canonical = new Set((leadRows ?? []).map((l: any) => String(l.id)));
        for (const l of leadRows ?? []) leadCreated.set(String(l.id), String(l.created_at));
        for (const r of rpcRows ?? []) {
          if (!canonical.has(String(r.lead_id))) continue;
          for (const [formId, names] of nameById.entries()) {
            if (names.includes(r.form_key)) {
              leadsByForm[formId] ??= new Set<string>();
              leadsByForm[formId].add(String(r.lead_id));
              if (!leadFormName.has(String(r.lead_id))) {
                leadFormName.set(String(r.lead_id), formRefs.find((f) => f.id === formId)?.name ?? r.form_key);
              }
            }
          }
        }
      }
    }

    // Visitas por slug. A RPC fn_kol_form_views exige is_admin(auth.uid()) e não
    // funciona com service role, então agregamos lead_page_views diretamente
    // (mesma regra: page_path = /f/{slug}, com query string ou subcaminho).
    const slugById = new Map<string, string>();
    for (const f of formRows ?? []) if (f.slug) slugById.set(f.id, f.slug);
    const viewsBySlug: Record<string, { views: number; visitors: number }> = {};
    const dailyByForm = new Map<string, Array<{ d: string; v: number }>>();
    if (slugById.size > 0) {
      const slugs = Array.from(slugById.values());
      const orFilter = slugs
        .flatMap((s) => [`page_path.eq./f/${s}`, `page_path.like./f/${s}?*`, `page_path.like./f/${s}/%`])
        .join(",");
      const [{ data: pvRows }, { data: metricRows }] = await Promise.all([
        admin.from("lead_page_views").select("page_path, ip_hash, session_id").or(orFilter).limit(50000),
        admin.rpc("fn_form_metrics", { p_period_days: 30 }),
      ]);
      for (const slug of slugs) {
        const rows = (pvRows ?? []).filter((r: any) => {
          const p = String(r.page_path ?? "");
          return p === `/f/${slug}` || p.startsWith(`/f/${slug}?`) || p.startsWith(`/f/${slug}/`);
        });
        const uniq = new Set(rows.map((r: any) => r.ip_hash ?? r.session_id).filter(Boolean));
        viewsBySlug[slug] = { views: rows.length, visitors: uniq.size };
      }
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

    // Nomes, telefones e data de criação dos leads (listas de compradores,
    // negociação e filtro de período dos leads gerados)
    const leadInfo = new Map<string, { nome: string | null; telefone: string | null }>();
    for (let i = 0; i < allLeads.length; i += 300) {
      const chunk = allLeads.slice(i, i + 300);
      const { data: infos } = await admin.from("lia_attendances")
        .select("id, nome, telefone_raw, telefone_normalized, created_at").in("id", chunk);
      for (const l of infos ?? []) {
        leadInfo.set(String(l.id), { nome: l.nome ?? null, telefone: l.telefone_normalized ?? l.telefone_raw ?? null });
        if (l.created_at) leadCreated.set(String(l.id), String(l.created_at));
      }
    }

    const wonByLead: Record<string, number> = {};
    const commByLead: Record<string, number> = {};
    for (let i = 0; i < allLeads.length; i += 300) {
      const chunk = allLeads.slice(i, i + 300);
      const { data: deals } = await admin.from("deals")
        .select("id, piperun_deal_id, lead_id, value, status, is_deleted, closed_at, owner_name, stage_name, product, deal_title")
        .in("lead_id", chunk);
      const alive = (deals ?? []).filter((d: any) => !d.is_deleted);
      const won = alive.filter((d: any) => d.status === "ganha" && (!from && !to ? true : inRange(d.closed_at)));
      for (const d of won) wonByLead[d.lead_id] = (wonByLead[d.lead_id] ?? 0) + Number(d.value ?? 0);

      // Negócios em negociação (abertos) — sem filtro de período
      for (const d of alive) {
        const st = String(d.status ?? "").toLowerCase();
        if (st === "ganha" || st === "perdida") continue;
        const info = leadInfo.get(String(d.lead_id));
        negotiating.push({
          deal_id: String(d.piperun_deal_id ?? d.id),
          lead_id: String(d.lead_id),
          lead_nome: info?.nome ?? null,
          lead_telefone: info?.telefone ?? null,
          origem: leadFormName.get(String(d.lead_id)) ?? "—",
          produto: d.product ?? d.deal_title ?? null,
          valor: Number(d.value ?? 0),
          etapa: d.stage_name ?? null,
        });
      }

      const dealIds = new Set<string>();
      const dealDate: Record<string, string | null> = {};
      const wonById = new Map<string, any>();
      for (const d of won) {
        for (const k of [d.id, d.piperun_deal_id].filter(Boolean).map(String)) {
          dealIds.add(k);
          dealDate[k] = d.closed_at ? String(d.closed_at).slice(0, 10) : null;
          wonById.set(k, d);
        }
      }
      const covered = new Set<string>();
      const itemsByDeal = new Map<string, { names: string[]; com: number }>();
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
          const agg = itemsByDeal.get(did) ?? { names: [], com: 0 };
          if (!agg.names.includes(raw)) agg.names.push(raw);
          if (com != null) agg.com += com;
          itemsByDeal.set(did, agg);
        }
      }
      if (fallbackPct != null) {
        for (const d of won) {
          const hit = [d.id, d.piperun_deal_id].filter(Boolean).some((k) => covered.has(String(k)));
          if (!hit) commByLead[d.lead_id] = (commByLead[d.lead_id] ?? 0) + (Number(d.value ?? 0) * fallbackPct) / 100;
        }
      }

      // Lista "Quem comprou através de formulários"
      for (const d of won) {
        const key = String(d.piperun_deal_id ?? d.id);
        const agg = itemsByDeal.get(key) ?? itemsByDeal.get(String(d.id));
        const info = leadInfo.get(String(d.lead_id));
        buyersForms.push({
          deal_id: key,
          lead_id: String(d.lead_id),
          lead_nome: info?.nome ?? null,
          origem: leadFormName.get(String(d.lead_id)) ?? "—",
          produto: agg?.names.join(" + ") || d.product || d.deal_title || null,
          valor: Number(d.value ?? 0),
          comissao: agg ? agg.com : (fallbackPct != null ? (Number(d.value ?? 0) * fallbackPct) / 100 : null),
          vendedora: d.owner_name ?? null,
          // Data em que o lead preencheu o formulário (criação do lead)
          data: leadCreated.get(String(d.lead_id))?.slice(0, 10) ?? null,
          data_fechamento: d.closed_at ? String(d.closed_at).slice(0, 10) : null,
        });
      }
    }

    for (const f of formRefs) {
      const leadSet = leadsByForm[f.id] ?? new Set<string>();
      // Leads gerados no período: filtra pela data de criação do lead
      const leadsInPeriod = Array.from(leadSet).filter((l) => (!from && !to) ? true : inRange(leadCreated.get(l)));
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
        leads: leadsInPeriod.length,
        deals_ganhos: won.length,
        conversao: leadsInPeriod.length > 0 ? won.length / leadsInPeriod.length : 0,
        receita,
        comissao,
      });
    }
  }

  // Cupons (Loja Integrada) com interseção entre vigência do cupom e período selecionado
  const couponsPerf: any[] = [];
  const buyersCoupon: BuyerCouponRow[] = [];
  for (const rule of rules) {
    const ruleFrom = rule.active_from ? String(rule.active_from).slice(0, 10) : null;
    const ruleTo = rule.active_to ? String(rule.active_to).slice(0, 10) : null;
    const effFrom = from && ruleFrom ? (from > ruleFrom ? from : ruleFrom) : (from ?? ruleFrom);
    const effTo = to && ruleTo ? (to < ruleTo ? to : ruleTo) : (to ?? ruleTo);
    const { data: cRows } = await admin.rpc("fn_kol_coupon_sales", { _code: rule.code, _from: effFrom, _to: effTo });
    const r0 = (cRows ?? [])[0] ?? {};
    couponsPerf.push({
      cupom: rule.code,
      active_from: rule.active_from ?? null,
      active_to: rule.active_to ?? null,
      commission_percent: rule.commission_percent ?? null,
      vendas: Number(r0.vendas) || 0,
      receita: Number(r0.receita) || 0,
      clientes: Number(r0.clientes) || 0,
    });

    // Lista "Quem comprou no e-commerce": pedidos com o cupom no período
    let q = admin.from("loja_integrada_orders")
      .select("id, attendance_id, numero_pedido, status, data_pedido, valor_total, cupom_codigo")
      .ilike("cupom_codigo", rule.code)
      .order("data_pedido", { ascending: false })
      .limit(500);
    if (effFrom) q = q.gte("data_pedido", effFrom);
    if (effTo) q = q.lte("data_pedido", effTo);
    const { data: orders } = await q;
    const valid = (orders ?? []).filter((o: any) => !CANCELLED.includes(String(o.status ?? "").toLowerCase()));
    const attIds = [...new Set(valid.map((o: any) => o.attendance_id).filter(Boolean).map(String))];
    const buyerNames = new Map<string, string | null>();
    if (attIds.length) {
      const { data: atts } = await admin.from("lia_attendances").select("id, nome").in("id", attIds);
      for (const a of atts ?? []) buyerNames.set(String(a.id), a.nome ?? null);
    }
    const orderIds = valid.map((o: any) => o.id).filter(Boolean);
    const itemsByOrder = new Map<string, { names: string[]; com: number; hasRule: boolean }>();
    if (orderIds.length) {
      const { data: items } = await admin.from("loja_integrada_order_items")
        .select("order_id, nome_produto, nome_canonico, quantidade, valor_total")
        .in("order_id", orderIds).limit(5000);
      for (const it of items ?? []) {
        const oid = String(it.order_id);
        const raw = it.nome_canonico || it.nome_produto || "(sem nome)";
        const c = classify(raw);
        const val = Number(it.valor_total) || 0;
        const order = valid.find((o: any) => String(o.id) === oid);
        const pct = pctFor(raw, c.cat, c.sub, order?.data_pedido ? String(order.data_pedido).slice(0, 10) : null, rule.commission_percent ?? null);
        const agg = itemsByOrder.get(oid) ?? { names: [], com: 0, hasRule: false };
        if (!agg.names.includes(raw)) agg.names.push(raw);
        if (pct != null) { agg.com += (val * pct) / 100; agg.hasRule = true; }
        itemsByOrder.set(oid, agg);
      }
    }
    for (const o of valid) {
      const agg = itemsByOrder.get(String(o.id));
      const valor = Number(o.valor_total) || 0;
      buyersCoupon.push({
        pedido: o.numero_pedido ? `#${o.numero_pedido}` : String(o.id).slice(0, 8),
        lead_nome: o.attendance_id ? (buyerNames.get(String(o.attendance_id)) ?? null) : null,
        origem: "Loja Integrada",
        produto: agg?.names.join(" + ") || null,
        valor,
        comissao: agg?.hasRule ? agg.com : (rule.commission_percent != null ? (valor * rule.commission_percent) / 100 : null),
        cupom: rule.code,
        data: o.data_pedido ? String(o.data_pedido).slice(0, 10) : null,
      });
    }
  }

  const dailyTotals = new Map<string, number>();
  for (const form of forms) {
    for (const point of form.daily_series) dailyTotals.set(point.d, (dailyTotals.get(point.d) ?? 0) + point.v);
  }
  const comissaoLeads = forms.reduce((s, f) => s + (f.comissao ?? 0), 0);
  const comissaoCupons = couponsPerf.reduce((s, c) => s + (c.commission_percent != null ? (c.receita * c.commission_percent) / 100 : 0), 0);
  const temRegraComissao = prulesAll.length > 0 || crulesAll.length > 0 || fallbackPct != null;

  return {
    professional_name: lead?.nome ?? null,
    forms,
    coupons: couponsPerf,
    buyers_forms: buyersForms.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")),
    buyers_coupon: buyersCoupon,
    negotiating: negotiating.sort((a, b) => b.valor - a.valor),
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

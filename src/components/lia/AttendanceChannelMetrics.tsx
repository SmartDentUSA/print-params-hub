import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { parseSimulators, type LandingSimulator } from "@/lib/lp/customLanding";
import { CLICK_ORIGINS, CLICK_ORIGIN_LABEL } from "@/lib/clickOrigin";
import { groupProductSimulators, productIdFromSimulator, withAllProductSimulators } from "@/lib/productSimulators";
import { isCommercialCampaignForm } from "@/lib/commercialCampaignForm";
import { loadCommercialCatalog } from "@/components/smartops/ProductSimulatorsPanel";

type Row = { channel: string; views: number; leads: number; conversions: number; revenue: number };
type SimRow = { simulator_id: string; label: string; views: number; leads: number; conversions: number; revenue: number };

/** Todos os simuladores da landing aparecem (mesmo sem movimento), mais qualquer outro registrado no período. */
function mergeSimulators(list: LandingSimulator[], data: any[]): SimRow[] {
  const byId = new Map<string, any>((data ?? []).map((r: any) => [String(r.simulator_id), r]));
  const rows: SimRow[] = list.map((s) => {
    const r = byId.get(s.id); byId.delete(s.id);
    return { simulator_id: s.id, label: s.label, views: +(r?.views ?? 0), leads: +(r?.leads ?? 0), conversions: +(r?.conversions ?? 0), revenue: +(r?.revenue ?? 0) };
  });
  for (const [id, r] of byId) rows.push({ simulator_id: id, label: id, views: +r.views, leads: +r.leads, conversions: +r.conversions, revenue: +r.revenue });
  return rows;
}
type OriginRow = { origin: string; clicks: number; views: number; whatsapp_opens: number; leads: number; conversions: number; revenue: number };
/** Todas as origens marcáveis aparecem (mesmo zeradas); "sem origem" só quando houver movimento. */
function mergeOrigins(data: any[]): OriginRow[] {
  const by = new Map<string, any>((data ?? []).map((r: any) => [String(r.origin), r]));
  const num = (r: any): Omit<OriginRow, "origin"> => ({ clicks: +(r?.clicks ?? 0), views: +(r?.views ?? 0), whatsapp_opens: +(r?.whatsapp_opens ?? 0), leads: +(r?.leads ?? 0), conversions: +(r?.conversions ?? 0), revenue: +(r?.revenue ?? 0) });
  const rows: OriginRow[] = CLICK_ORIGINS.map((o) => ({ origin: o, ...num(by.get(o)) }));
  if (by.has("direto")) rows.push({ origin: "direto", ...num(by.get("direto")) });
  return rows;
}
/** Simulador de produto sem nenhum movimento: fica recolhido para a tabela não virar uma lista enorme. */
const isIdleProduct = (s: SimRow) => !!productIdFromSimulator(s.simulator_id) && !s.views && !s.leads && !s.conversions;
const LABEL: Record<string, string> = { form: "Formulário", specialist: "Falar com especialista", whatsapp_lia: "WhatsApp (Dra. LIA)" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function AttendanceChannelMetrics({ formId, campaignSlug, days = 90, title, formOverride }: { formId?: string | null; campaignSlug?: string | null; days?: number; title?: string; formOverride?: { views: number; leads: number; conversions: number; revenue: number } }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sims, setSims] = useState<SimRow[]>([]);
  const [showIdleProducts, setShowIdleProducts] = useState(false);
  const [origins, setOrigins] = useState<OriginRow[]>([]);
  useEffect(() => {
    setOrigins([]);
    if (!formId) return;
    let cancelled = false;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    (supabase as any).rpc("fn_attendance_origin_metrics", { _form_id: formId, _since: since })
      .then(({ data, error }: any) => { if (!cancelled && !error) setOrigins(mergeOrigins(data ?? [])); }, () => {});
    return () => { cancelled = true; };
  }, [formId, days]);
  useEffect(() => {
    setSims([]);
    if (!formId) return;
    let cancelled = false;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    Promise.all([
      (supabase as any).from("smartops_form_landing_pages").select("custom_simulators").eq("form_id", formId).maybeSingle(),
      (supabase as any).rpc("fn_attendance_simulator_metrics", { _form_id: formId, _since: since }),
      (supabase as any).from("smartops_forms").select("name, is_commercial_campaign").eq("id", formId).maybeSingle(),
    ]).then(async ([lp, m, f]: any[]) => {
      if (cancelled) return;
      const list = parseSimulators(lp?.data?.custom_simulators);
      const commercial = !!f?.data && isCommercialCampaignForm(f.data);
      if (!commercial && !list.length && !(m?.data ?? []).length) return;
      let merged = mergeSimulators(list, m?.data ?? []);
      if (commercial) {
        // Campanha comercial: todos os produtos do catálogo têm simulador próprio; aparecem mesmo sem movimento.
        const catalog = await loadCommercialCatalog().catch(() => []);
        merged = withAllProductSimulators(merged, groupProductSimulators(catalog).flatMap((g) => g.items));
      }
      // Simuladores por produto fora do catálogo comercial atual: nome do produto em vez do identificador.
      const ids = [...new Set(merged.filter((r) => r.label === r.simulator_id).map((r) => productIdFromSimulator(r.simulator_id)).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: cat } = await (supabase as any).from("system_a_catalog").select("id, name").in("id", ids);
        const names = new Map<string, string>(((cat ?? []) as any[]).map((c) => [c.id, String(c.name ?? "").trim()]));
        for (const r of merged) {
          const pid = productIdFromSimulator(r.simulator_id);
          if (pid && r.label === r.simulator_id) r.label = names.get(pid) ? `Produto: ${names.get(pid)}` : "Produto do catálogo";
        }
      }
      if (!cancelled) setSims(merged);
    }, () => {});
    return () => { cancelled = true; };
  }, [formId, days]);
  useEffect(() => {
    setRows(null);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    (supabase as any).rpc("fn_attendance_channel_metrics", { _form_id: formId ?? null, _campaign_slug: campaignSlug ?? null, _since: since })
      .then(({ data }: any) => setRows((data ?? []).map((r: any) => ({ ...r, views: +r.views, leads: +r.leads, conversions: +r.conversions, revenue: +r.revenue, ...(formOverride && r.channel === "form" ? formOverride : {}) }))));
  }, [formId, campaignSlug, days, formOverride?.views, formOverride?.leads, formOverride?.conversions, formOverride?.revenue]);

  const productSims = sims.filter((s) => productIdFromSimulator(s.simulator_id)).length;
  const idleProducts = sims.filter(isIdleProduct).length;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title ?? `Comparativo por canal de atendimento (${days} dias)`}</CardTitle></CardHeader>
      <CardContent>
        {!rows ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1">Canal</th><th>Visualizações</th><th>Leads gerados</th><th>Taxa de lead</th><th>Conversões</th><th>Conversão</th><th>Valor das conversões</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (<Fragment key={r.channel}>
                  <tr className="border-t border-border">
                    <td className="py-1.5 font-medium">{LABEL[r.channel] ?? r.channel}</td>
                    <td>{r.views}</td>
                    <td>{r.leads}</td>
                    <td>{r.views ? `${((r.leads / r.views) * 100).toFixed(1)}%` : "—"}</td>
                    <td>{r.conversions}</td>
                    <td>{r.leads ? `${((r.conversions / r.leads) * 100).toFixed(1)}%` : "—"}</td>
                    <td>{brl(r.revenue)}</td>
                  </tr>
                  {r.channel === "whatsapp_lia" && sims.filter((s) => showIdleProducts || !isIdleProduct(s)).map((s) => (
                    <tr key={`sim-${s.simulator_id}`} className="text-muted-foreground">
                      <td className="py-1 pl-4 text-xs" title={`Identificador: ${s.simulator_id}`}>↳ {s.label} <span className="opacity-70">({s.simulator_id})</span></td>
                      <td className="text-xs">{s.views}</td>
                      <td className="text-xs">{s.leads}</td>
                      <td className="text-xs">{s.views ? `${((s.leads / s.views) * 100).toFixed(1)}%` : "—"}</td>
                      <td className="text-xs">{s.conversions}</td>
                      <td className="text-xs">{s.leads ? `${((s.conversions / s.leads) * 100).toFixed(1)}%` : "—"}</td>
                      <td className="text-xs">{brl(s.revenue)}</td>
                    </tr>
                  ))}
                  {r.channel === "whatsapp_lia" && idleProducts > 0 && (
                    <tr className="text-muted-foreground">
                      <td colSpan={7} className="py-1 pl-4 text-xs">
                        <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setShowIdleProducts((v) => !v)}>
                          {showIdleProducts ? "Ocultar produtos sem movimento" : `Mostrar os ${productSims} simuladores por produto do catálogo (${idleProducts} ainda sem movimento)`}
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>))}
              </tbody>
            </table>
            {origins.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium">Origem dos cliques</div>
                <table className="mt-1 w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-1">Origem</th><th>Cliques no link</th><th>Visitas na landing</th><th>Cliques no WhatsApp</th><th>Leads gerados</th><th>Conversões</th><th>Valor das conversões</th></tr>
                  </thead>
                  <tbody>
                    {origins.map((o) => (
                      <tr key={o.origin} className="border-t border-border">
                        <td className="py-1.5 font-medium">{CLICK_ORIGIN_LABEL[o.origin as keyof typeof CLICK_ORIGIN_LABEL] ?? o.origin}</td>
                        <td>{o.clicks}</td>
                        <td>{o.views}</td>
                        <td>{o.whatsapp_opens}</td>
                        <td>{o.leads}</td>
                        <td>{o.conversions}</td>
                        <td>{brl(o.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-muted-foreground">Cada origem conta os links curtos marcados (?o=email, ?o=sms, ?o=whatsapp, ?o=grupos, ?o=bio), copiados pelo botão "origem" no card do formulário ou inseridos pelas telas de e-mail, SMS e WhatsApp. Sem marcação, a origem é deduzida pelo site de onde a pessoa veio (Instagram, Facebook, Google...). "Acesso direto" reúne quem chegou sem nenhuma pista; "Antes da marcação" são acessos anteriores a 16/11 16:18.</p>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Visualizações: aberturas da página (formulário) e cliques nos botões (especialista e WhatsApp). Conversão conta só negócios ganhos depois da captura. {sims.length ? "Abaixo do WhatsApp, cada simulador da landing (geral e por produto) com seu identificador; a contagem por simulador começa a partir de hoje. " : ""}{formOverride ? "A linha Formulário usa os mesmos números do card; especialista e WhatsApp contam a partir da ativação do rastreio." : "Os dados começam a contar a partir de hoje."}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

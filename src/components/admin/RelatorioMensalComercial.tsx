import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CopilotBrainHealthCard from "@/components/admin/CopilotBrainHealthCard";

/* ---------- Types ---------- */
interface Kpis {
  deals_ganhos: number | null;
  deals_criados: number | null;
  receita_won: number | null;
  ticket_medio: number | null;
  funil_ativo: number | null;
  perdidas_mes: number | null;
  enviados_estagnados: number | null;
  clientes_unicos: number | null;
  taxa_conversao: number | null;
  mes_ref: string | null;
  gerado_em: string | null;
}
interface VendedorRow {
  vendedor: string | null;
  deals_ganhos: number | null;
  receita: number | null;
  ticket_medio: number | null;
  perdidos: number | null;
  leads_mes: number | null;
}
interface VendedorDetalheRow {
  vendedor: string | null;
  total_criados: number | null;
  abertas: number | null;
  ganhas: number | null;
  perdidas: number | null;
  estagnados: number | null;
  estagnados_pct: number | null;
  avg_dias_etapa_vendas: number | null;
  cs_count: number | null;
  cs_lead_time_dias: number | null;
}
interface FunilRow {
  vendedor: string | null;
  funil: string | null;
  etapa: string | null;
  qtd: number | null;
}
interface OrigemRow {
  origem: string | null;
  total_leads: number | null;
  deals_ganhos: number | null;
  receita: number | null;
  taxa_pct: number | null;
}
interface ItensKpis {
  total_unidades: number | null;
  total_linhas: number | null;
  total_deals: number | null;
  skus_distintos: number | null;
  top_volume_nome: string | null;
  top_volume_qtd: number | null;
  top_deals_nome: string | null;
  top_deals_count: number | null;
}
interface ItemTopRow { nome: string | null; deals: number | null; unidades: number | null }
interface CategoriaRow { categoria: string | null; deals: number | null; unidades: number | null }
interface ItemVendedorRow { vendedor: string | null; linhas: number | null; unidades: number | null; skus: number | null }
interface RecorrenciaRow { clientes_unicos: number | null; recorrentes: number | null; novos: number | null; taxa_pct: number | null }
interface AstronRow {
  total_inscritos: number | null;
  clientes_sd: number | null;
  nao_clientes: number | null;
  pct_clientes: number | null;
  novos_mes: number | null;
  media_concluidos: number | null;
}

/* ---------- Helpers ---------- */
const nf = new Intl.NumberFormat("pt-BR");
const fmtBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v ?? 0));
const fmtBRLk = (v: number | null | undefined) => {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1000) return `R$${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return fmtBRL(n);
};
const fmtNum = (v: number | null | undefined) => nf.format(Number(v ?? 0));
const fmtPct = (v: number | null | undefined, d = 1) => `${Number(v ?? 0).toFixed(d)}%`;
const periodoLabel = (ano: number, mes: number) => {
  const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  return `${meses[mes - 1]} ${ano}`;
};
const todayBR = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const pillForPct = (pct: number) => {
  if (pct >= 50) return "phi";
  if (pct >= 20) return "pmi";
  if (pct >= 5) return "plo";
  return "pze";
};
const barColorForPct = (pct: number) => {
  if (pct >= 75) return "#ff5e5e";
  if (pct >= 50) return "#f5a623";
  return "#3ecf8e";
};

export default function RelatorioMensalComercial() {
  const nowSP = useMemo(() => {
    const s = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    return new Date(s);
  }, []);
  const [ano, setAno] = useState<number>(nowSP.getFullYear());
  const [mes, setMes] = useState<number>(nowSP.getMonth() + 1);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [detalhe, setDetalhe] = useState<VendedorDetalheRow[]>([]);
  const [funilAtual, setFunilAtual] = useState<FunilRow[]>([]);
  const [origens, setOrigens] = useState<OrigemRow[]>([]);
  const [itensKpis, setItensKpis] = useState<ItensKpis | null>(null);
  const [itensTop, setItensTop] = useState<ItemTopRow[]>([]);
  const [categorias, setCategorias] = useState<CategoriaRow[]>([]);
  const [itensVendedor, setItensVendedor] = useState<ItemVendedorRow[]>([]);
  const [recor, setRecor] = useState<RecorrenciaRow | null>(null);
  const [astron, setAstron] = useState<AstronRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { p_ano: ano, p_mes: mes } as any;
      const results = await Promise.all([
        supabase.rpc("fn_relatorio_mes_kpis" as any, params),
        supabase.rpc("fn_relatorio_mes_vendedor" as any, params),
        supabase.rpc("fn_relatorio_mes_vendedor_detalhe" as any, params),
        supabase.rpc("fn_relatorio_mes_funil_atual" as any, params),
        supabase.rpc("fn_relatorio_mes_origem" as any, params),
        supabase.rpc("fn_relatorio_mes_itens_kpis" as any, params),
        supabase.rpc("fn_relatorio_mes_itens_top" as any, { ...params, p_limit: 20 }),
        supabase.rpc("fn_relatorio_mes_itens_categoria" as any, params),
        supabase.rpc("fn_relatorio_mes_itens_vendedor" as any, params),
        supabase.rpc("fn_relatorio_mes_recorrencia" as any, params),
        supabase.rpc("fn_relatorio_mes_astron" as any, params),
      ]);
      for (const r of results) if (r.error) throw r.error;
      const [k, v, vd, f, o, ik, it, c, iv, rc, ast] = results;
      const kArr = (k.data as any[]) ?? [];
      setKpis((Array.isArray(kArr) ? kArr[0] : kArr) ?? null);
      setVendedores(((v.data as any[]) ?? []) as VendedorRow[]);
      setDetalhe(((vd.data as any[]) ?? []) as VendedorDetalheRow[]);
      setFunilAtual(((f.data as any[]) ?? []) as FunilRow[]);
      setOrigens(((o.data as any[]) ?? []) as OrigemRow[]);
      const ikArr = (ik.data as any[]) ?? [];
      setItensKpis((Array.isArray(ikArr) ? ikArr[0] : ikArr) ?? null);
      setItensTop(((it.data as any[]) ?? []) as ItemTopRow[]);
      setCategorias(((c.data as any[]) ?? []) as CategoriaRow[]);
      setItensVendedor(((iv.data as any[]) ?? []) as ItemVendedorRow[]);
      const rcArr = (rc.data as any[]) ?? [];
      setRecor((Array.isArray(rcArr) ? rcArr[0] : rcArr) ?? null);
      const aArr = (ast.data as any[]) ?? [];
      setAstron((Array.isArray(aArr) ? aArr[0] : aArr) ?? null);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar o relatório.");
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* derived */
  const totalLeads = Number(kpis?.deals_criados ?? 0);
  const totalGanhos = Number(kpis?.deals_ganhos ?? 0);
  const conversaoMes = totalLeads > 0 ? (totalGanhos / totalLeads) * 100 : 0;

  // Map vendor cohort detalhe by name for fast lookup
  const detalheByVendor = useMemo(() => {
    const m = new Map<string, VendedorDetalheRow>();
    for (const r of detalhe) m.set(r.vendedor || "—", r);
    return m;
  }, [detalhe]);

  const vendedoresUnificados = useMemo(() => {
    type Row = {
      vendedor: string;
      total: number; ganhos: number; perdidos: number;
      conv: number; receita: number; ticket: number;
    };
    const map = new Map<string, Row>();
    for (const d of detalhe) {
      const name = d.vendedor || "—";
      map.set(name, {
        vendedor: name,
        total: Number(d.total_criados ?? 0),
        ganhos: Number(d.ganhas ?? 0),
        perdidos: Number(d.perdidas ?? 0),
        conv: 0, receita: 0, ticket: 0,
      });
    }
    for (const v of vendedores) {
      const name = v.vendedor || "—";
      const cur = map.get(name) ?? {
        vendedor: name,
        total: Number(v.leads_mes ?? 0),
        ganhos: Number(v.deals_ganhos ?? 0),
        perdidos: Number(v.perdidos ?? 0),
        conv: 0, receita: 0, ticket: 0,
      };
      cur.receita = Number(v.receita ?? 0);
      cur.ticket = Number(v.ticket_medio ?? 0);
      // prefer vendedor data for ganhos/perdidos when detalhe missing
      if (!cur.total) cur.total = Number(v.leads_mes ?? 0);
      map.set(name, cur);
    }
    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      conv: r.total > 0 ? (r.ganhos / r.total) * 100 : 0,
    }));
    // Only sellers active in month
    return rows.filter((r) => r.total > 0 || r.ganhos > 0 || r.perdidos > 0)
      .sort((a, b) => b.receita - a.receita || b.ganhos - a.ganhos);
  }, [vendedores, detalhe]);

  const totals = useMemo(() => vendedoresUnificados.reduce(
    (a, v) => ({
      total: a.total + v.total, ganhos: a.ganhos + v.ganhos,
      perdidos: a.perdidos + v.perdidos, receita: a.receita + v.receita,
    }),
    { total: 0, ganhos: 0, perdidos: 0, receita: 0 },
  ), [vendedoresUnificados]);

  // Funil por vendedor: top 5 etapas em funis de vendas (não estagnados)
  const funilPorVendedor = useMemo(() => {
    const map = new Map<string, { etapa: string; funil: string; qtd: number }[]>();
    for (const f of funilAtual) {
      if ((f.funil || "").toLowerCase().includes("estagnados")) continue;
      const v = f.vendedor || "—";
      const arr = map.get(v) ?? [];
      arr.push({ etapa: f.etapa || "—", funil: f.funil || "—", qtd: Number(f.qtd ?? 0) });
      map.set(v, arr);
    }
    return map;
  }, [funilAtual]);

  const cardsFunil = useMemo(() => {
    return vendedoresUnificados.map((v) => {
      const d = detalheByVendor.get(v.vendedor);
      const etapas = (funilPorVendedor.get(v.vendedor) ?? []).sort((a, b) => b.qtd - a.qtd);
      const top = etapas.slice(0, 5);
      const funilTotal = etapas.reduce((s, e) => s + e.qtd, 0);
      const estagnados = Number(d?.estagnados ?? 0);
      const estagnadosPct = Number(d?.estagnados_pct ?? 0);
      const abertas = Number(d?.abertas ?? 0);
      const perdidas = Number(d?.perdidas ?? 0);
      const totalCriados = Number(d?.total_criados ?? 0);
      const avgDiasEtapa = Number(d?.avg_dias_etapa_vendas ?? 0);
      const csCount = Number(d?.cs_count ?? 0);
      const csLeadTime = Number(d?.cs_lead_time_dias ?? 0);
      return { v, top, funilTotal, estagnados, estagnadosPct, abertas, perdidas, totalCriados, avgDiasEtapa, csCount, csLeadTime };
    }).sort((a, b) => b.estagnados - a.estagnados);
  }, [vendedoresUnificados, detalheByVendor, funilPorVendedor]);

  const origensFiltradas = useMemo(
    () => [...origens].sort((a, b) => Number(b.receita ?? 0) - Number(a.receita ?? 0)),
    [origens],
  );

  // Selector
  const monthOptions = useMemo(() => {
    const opts: { ano: number; mes: number; label: string }[] = [];
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const base = new Date(nowSP.getFullYear(), nowSP.getMonth(), 1);
    for (let i = 0; i < 24; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      opts.push({ ano: d.getFullYear(), mes: d.getMonth() + 1, label: `${meses[d.getMonth()]}/${d.getFullYear()}` });
    }
    return opts;
  }, [nowSP]);
  const selectedKey = `${ano}-${String(mes).padStart(2, "0")}`;

  const maxItensQtd = Math.max(1, ...itensTop.map((i) => Number(i.unidades ?? 0)));

  if (error) {
    return (
      <div className="rmc-root p-6">
        <div className="flex items-start gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-medium">Não foi possível carregar o relatório</div>
            <div className="text-sm opacity-80 mt-1">{error}</div>
            <button className="mt-3 px-3 py-1 border border-current rounded text-xs" onClick={fetchAll}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rmc-root">
      <RmcStyles />
      <div className="page">

        {/* Header */}
        <div className="header">
          <div>
            <div className="logo">Smart<span>Dent</span></div>
            <div className="sub">
              Relatório Comercial · Fonte: PipeRun · Atualizado {lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Select value={selectedKey} onValueChange={(val) => {
              const [y, m] = val.split("-").map(Number);
              setAno(y); setMes(m);
            }}>
              <SelectTrigger className="w-[150px] h-9 bg-[var(--bg3)] border-[var(--border)] text-[var(--text)] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg2)] border-[var(--border)] text-[var(--text)]">
                {monthOptions.map((o) => (
                  <SelectItem key={`${o.ano}-${o.mes}`} value={`${o.ano}-${String(o.mes).padStart(2, "0")}`}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={fetchAll} disabled={loading}
              title="Atualizar agora"
              className="h-9 w-9 inline-flex items-center justify-center rounded border border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] hover:text-[var(--text)]">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <div style={{ textAlign: "right" }}>
              <div className="period">{periodoLabel(ano, mes)}</div>
              <div className="generated">
                {fmtNum(totalLeads)} oportunidades criadas · {fmtNum(kpis?.clientes_unicos ?? 0)} clientes únicos<br />
                Coorte do mês · timezone America/Sao_Paulo
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <CopilotBrainHealthCard />
        <div className="sl">Visão Geral do Mês</div>
        <div className="kpi4">
          <Kpi color="g" label="Receita (P&S)" value={fmtBRLk(kpis?.receita_won)} sub={`${fmtNum(totalGanhos)} deals ganhos`} />
          <Kpi label="Oportunidades criadas" value={fmtNum(totalLeads)} sub={`${fmtNum(kpis?.clientes_unicos ?? 0)} clientes únicos`} />
          <Kpi color="a" label="Ticket médio" value={fmtBRL(kpis?.ticket_medio)} sub={`vendedores ativos: ${fmtNum(vendedoresUnificados.length)}`} />
          <Kpi color="t" label="Conversão (coorte)" value={fmtPct(conversaoMes)} sub="ganhos / criados no mês" />
        </div>
        <div className="kpi3">
          <Kpi color="g" label="Funil ativo (abertas)" value={fmtNum(kpis?.funil_ativo)} sub="pipeline da coorte" />
          <Kpi color="r" label="Perdidas no mês" value={fmtNum(kpis?.perdidas_mes)} sub="deals descartados da coorte" />
          <Kpi color="p" label="Enviados p/ estagnados" value={fmtNum(kpis?.enviados_estagnados)} sub="aberto em pipeline Estagnados" />
        </div>

        {/* Vendas por Vendedor */}
        <div className="section" style={{ marginTop: 28 }}>
          <div className="sl">Vendas por Vendedor — Deals Criados e Ganhos em {periodoLabel(ano, mes)}</div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th className="r">Deals total</th>
                  <th className="r">Ganhos</th>
                  <th className="r">Perdidos</th>
                  <th className="r">Conversão</th>
                  <th className="r">Receita</th>
                  <th className="r">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {vendedoresUnificados.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    {loading ? "Carregando…" : "Sem dados para o período."}
                  </td></tr>
                )}
                {vendedoresUnificados.map((v) => {
                  const pillCls = pillForPct(v.conv);
                  const bar = Math.min(100, (v.conv / 35) * 100);
                  return (
                    <tr key={v.vendedor}>
                      <td>{v.vendedor}</td>
                      <td className="r m">{fmtNum(v.total)}</td>
                      <td className="r m" style={{ color: v.ganhos > 0 ? "var(--green)" : undefined }}>{fmtNum(v.ganhos)}</td>
                      <td className="r m" style={{ color: v.perdidos >= 5 ? "var(--red)" : v.perdidos >= 3 ? "var(--amber)" : undefined }}>{fmtNum(v.perdidos)}</td>
                      <td className="r">
                        <span className={`pill ${pillCls}`}>{fmtPct(v.conv)}</span>
                        <span className="bar-w"><span className="bar-f" style={{ width: `${bar}%`, background: barColorForPct(v.conv) }} /></span>
                      </td>
                      <td className="r m" style={{ color: v.receita > 0 ? "var(--green)" : "var(--red)" }}>{fmtBRL(v.receita)}</td>
                      <td className="r m">{fmtBRL(v.ticket)}</td>
                    </tr>
                  );
                })}
                {vendedoresUnificados.length > 0 && (
                  <tr style={{ background: "var(--bg3)" }}>
                    <td style={{ color: "var(--text)", fontWeight: 600 }}>TOTAL</td>
                    <td className="r m" style={{ color: "var(--text)" }}>{fmtNum(totals.total)}</td>
                    <td className="r m" style={{ color: "var(--green)" }}>{fmtNum(totals.ganhos)}</td>
                    <td className="r m" style={{ color: "var(--red)" }}>{fmtNum(totals.perdidos)}</td>
                    <td className="r"><span style={{ fontFamily: "'DM Mono',monospace", color: "var(--teal)" }}>
                      {fmtPct(totals.total > 0 ? (totals.ganhos / totals.total) * 100 : 0)}
                    </span></td>
                    <td className="r m" style={{ color: "var(--green)" }}>{fmtBRL(totals.receita)}</td>
                    <td className="r m">{fmtBRL(totals.ganhos > 0 ? totals.receita / totals.ganhos : 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="tn">Coorte: deals com data de cadastro no mês selecionado. Conversão = ganhos no mês ÷ criados no mês.</div>
          </div>
        </div>

        {/* Conversão por Origem */}
        <div className="section">
          <div className="sl">Conversão por Origem — Mesma Coorte</div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th className="r">Total deals</th>
                  <th className="r">Ganhos</th>
                  <th className="r">Taxa</th>
                  <th className="r">Receita</th>
                </tr>
              </thead>
              <tbody>
                {origensFiltradas.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>Sem dados de origem.</td></tr>
                )}
                {origensFiltradas.map((o, i) => {
                  const pct = Number(o.taxa_pct ?? 0);
                  const cls = pillForPct(pct);
                  return (
                    <tr key={`${o.origem}-${i}`}>
                      <td>{o.origem || "(sem origem)"}</td>
                      <td className="r m">{fmtNum(o.total_leads)}</td>
                      <td className="r m">{fmtNum(o.deals_ganhos)}</td>
                      <td className="r"><span className={`pill ${cls}`}>{fmtPct(pct)}</span></td>
                      <td className="r m" style={{ color: Number(o.receita ?? 0) > 0 ? "var(--green)" : "var(--text3)" }}>
                        {Number(o.receita ?? 0) > 0 ? fmtBRL(o.receita) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Itens Vendidos */}
        <div className="section">
          <div className="sl">Itens Vendidos nas Propostas Ganhas — {periodoLabel(ano, mes)}</div>
          <div className="kpi4" style={{ marginBottom: 16 }}>
            <Kpi color="g" label="Total unidades" value={fmtNum(itensKpis?.total_unidades)} sub={`${fmtNum(itensKpis?.total_deals)} deals · ${fmtNum(itensKpis?.total_linhas)} linhas`} />
            <Kpi label="SKUs distintos" value={fmtNum(itensKpis?.skus_distintos)} sub="produtos únicos vendidos" />
            <Kpi color="t" label="Maior volume" value={itensKpis?.top_volume_nome || "—"} sub={`${fmtNum(itensKpis?.top_volume_qtd)} un`} />
            <Kpi color="a" label="Mais deals com item" value={itensKpis?.top_deals_nome || "—"} sub={`${fmtNum(itensKpis?.top_deals_count)} deals`} />
          </div>
          <div className="grid2">
            <div>
              <div className="grid-title">Top 20 produtos por unidades</div>
              <div className="tw">
                <table>
                  <thead><tr><th>#</th><th>Produto</th><th className="r">Deals</th><th className="r">Unidades</th></tr></thead>
                  <tbody>
                    {itensTop.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>Sem itens no período.</td></tr>
                    )}
                    {itensTop.map((p, idx) => {
                      const isBulk = Number(p.unidades ?? 0) > maxItensQtd * 0.5 && Number(p.deals ?? 0) <= 3;
                      return (
                        <tr key={`${p.nome}-${idx}`}>
                          <td className="m" style={{ color: "var(--text3)" }}>{String(idx + 1).padStart(2, "0")}</td>
                          <td>{p.nome}</td>
                          <td className="r m">{fmtNum(p.deals)}</td>
                          <td className="r m" style={{ color: isBulk ? "var(--amber)" : undefined }}>{fmtNum(p.unidades)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="tn">Itens com poucas vendas mas alto volume = bulk. Olhe a coluna Deals para penetração real.</div>
              </div>
            </div>

            <div>
              <div className="grid-title">Por categoria</div>
              <div className="tw" style={{ marginBottom: 14 }}>
                <table>
                  <thead><tr><th>Categoria</th><th className="r">Deals</th><th className="r">Unidades</th></tr></thead>
                  <tbody>
                    {categorias.length === 0 && (
                      <tr><td colSpan={3} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>—</td></tr>
                    )}
                    {categorias.map((c, idx) => (
                      <tr key={`${c.categoria}-${idx}`}>
                        <td style={{ color: (c.categoria || "").toLowerCase().includes("atos") ? "var(--amber)" : undefined }}>{c.categoria}</td>
                        <td className="r m">{fmtNum(c.deals)}</td>
                        <td className="r m" style={{ color: (c.categoria || "").toLowerCase().includes("atos") ? "var(--amber)" : undefined }}>{fmtNum(c.unidades)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid-title">Por vendedor</div>
              <div className="tw">
                <table>
                  <thead><tr><th>Vendedor</th><th className="r">Linhas</th><th className="r">Unidades</th><th className="r">SKUs</th></tr></thead>
                  <tbody>
                    {itensVendedor.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>—</td></tr>
                    )}
                    {itensVendedor.map((v, idx) => (
                      <tr key={`${v.vendedor}-${idx}`}>
                        <td>{v.vendedor}</td>
                        <td className="r m">{fmtNum(v.linhas)}</td>
                        <td className="r m">{fmtNum(v.unidades)}</td>
                        <td className="r m">{fmtNum(v.skus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Funil por Vendedor */}
        <div className="section">
          <div className="sl">
            Funil por Vendedor — Abertos (snapshot do mês) · Estagnados (criados no mês) · Perdidas/Ganhas (fechadas no mês)
          </div>
          {cardsFunil.length === 0 && (
            <div className="tw" style={{ padding: 24, textAlign: "center", color: "var(--text3)" }}>Sem dados de funil para o período.</div>
          )}
          {cardsFunil.map((c) => {
            const estCor = c.estagnadosPct >= 75 ? "var(--red)" : c.estagnadosPct >= 65 ? "var(--amber)" : "var(--green)";
            return (
              <div className="vc" key={c.v.vendedor}>
                <div className="vh">
                  <div className="vn">{c.v.vendedor}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>
                    {fmtNum(c.abertas)} abertas{" "}
                    {c.perdidas > 0 && <>· <span style={{ color: c.perdidas >= 5 ? "var(--red)" : "var(--amber)" }}>{fmtNum(c.perdidas)} perdidas</span></>}
                  </div>
                </div>
                <div className="vs">
                  <div className="vst">
                    <div className="vsl">→ Estagnados</div>
                    <div className="vsv" style={{ color: estCor }}>
                      {fmtNum(c.estagnados)} <span style={{ fontSize: 10, color: "var(--text3)" }}>{fmtPct(c.estagnadosPct)}</span>
                    </div>
                  </div>
                  <div className="vst">
                    <div className="vsl">Funil vendas</div>
                    <div className="vsv" style={{ color: "var(--blue)" }}>{fmtNum(c.funilTotal)}</div>
                  </div>
                  {c.top.map((e, i) => (
                    <div className="vst" key={i}>
                      <div className="vsl" title={e.funil}>{e.etapa}</div>
                      <div className="vsv">{fmtNum(e.qtd)}</div>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 4 - c.top.length) }).map((_, i) => (
                    <div className="vst" key={`e-${i}`}>
                      <div className="vsl">—</div>
                      <div className="vsv" style={{ color: "var(--text3)" }}>—</div>
                    </div>
                  ))}
                </div>
                <div className="vd">
                  De {fmtNum(c.totalCriados)} deals criados no mês: {fmtNum(c.estagnados)} já em Estagnados ({fmtPct(c.estagnadosPct)}) · {fmtNum(c.funilTotal)} ativos no funil de vendas
                </div>
              </div>
            );
          })}
        </div>

        {/* Recorrência + Astron */}
        <div className="section">
          <div className="grid2">
            <div>
              <div className="sl">Vendas Recorrentes</div>
              <div className="tw">
                <table>
                  <thead><tr><th>Métrica</th><th className="r">Valor</th></tr></thead>
                  <tbody>
                    <tr><td>Clientes únicos com ganho no mês</td><td className="r m">{fmtNum(recor?.clientes_unicos)}</td></tr>
                    <tr><td>Com compra anterior registrada (recorrentes)</td><td className="r m" style={{ color: "var(--green)" }}>{fmtNum(recor?.recorrentes)}</td></tr>
                    <tr><td>1ª compra registrada (novos)</td><td className="r m" style={{ color: "var(--blue)" }}>{fmtNum(recor?.novos)}</td></tr>
                    <tr><td>Taxa de recorrência</td><td className="r m" style={{ color: "var(--amber)" }}>{fmtPct(recor?.taxa_pct ?? 0)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="sl">Astron — Base de Inscritos</div>
              <div className="tw">
                <table>
                  <thead><tr><th>Segmento</th><th className="r">Qtd</th><th className="r">%</th></tr></thead>
                  <tbody>
                    <tr><td>Total inscritos ativos</td><td className="r m">{fmtNum(astron?.total_inscritos)}</td><td className="r m">100%</td></tr>
                    <tr><td>São clientes Smart Dent</td>
                      <td className="r m" style={{ color: "var(--green)" }}>{fmtNum(astron?.clientes_sd)}</td>
                      <td className="r m" style={{ color: "var(--green)" }}>{fmtPct(astron?.pct_clientes ?? 0)}</td></tr>
                    <tr><td>Não são clientes Smart Dent</td>
                      <td className="r m" style={{ color: "var(--amber)" }}>{fmtNum(astron?.nao_clientes)}</td>
                      <td className="r m" style={{ color: "var(--amber)" }}>{fmtPct(100 - Number(astron?.pct_clientes ?? 0))}</td></tr>
                    <tr><td>Novos inscritos no mês</td><td className="r m" colSpan={2}>{fmtNum(astron?.novos_mes)}</td></tr>
                    <tr><td>Média de aulas concluídas</td><td className="r m" colSpan={2}>{Number(astron?.media_concluidos ?? 0).toFixed(1)}</td></tr>
                  </tbody>
                </table>
              </div>
              {Number(astron?.total_inscritos ?? 0) === 0 && (
                <div className="alert">Astron sem dados. Job <code>sync-astron-members</code> pode estar desatualizado.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <div style={{ fontSize: 11, color: "var(--text3)" }}>
            Fonte: PipeRun ({lastUpdated ? `${todayBR(lastUpdated)} ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—"}) ·
            Valores P&S sem freight · Não inclui Omie / NF fiscal · Astron via <code>astron_member_access</code>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--text3)" }}>
            MMTech · CNPJ 10.736.894/0001-36
          </div>
        </div>

      </div>
    </div>
  );
}

/* ---------- Sub components ---------- */
function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: "g" | "a" | "r" | "p" | "t" }) {
  const valColor =
    color === "g" ? "var(--green)" :
    color === "a" ? "var(--amber)" :
    color === "r" ? "var(--red)" :
    color === "p" ? "var(--purple)" :
    color === "t" ? "var(--teal)" : undefined;
  return (
    <div className={`kpi ${color ?? ""}`}>
      <div className="lbl">{label}</div>
      <div className="val" style={{ color: valColor }}>{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

function RmcStyles() {
  return (
    <style>{`
      .rmc-root{
        --bg:#0c0e13;--bg2:#13161d;--bg3:#1a1e28;
        --border:#2a3040;
        --text:#e8ecf4;--text2:#8b93a8;--text3:#5a6278;
        --blue:#4a8fff;--blue2:#1a3a6e;
        --green:#3ecf8e;--green2:#0f3d28;
        --amber:#f5a623;--amber2:#3d2a0a;
        --red:#ff5e5e;--red2:#3d1414;
        --purple:#a78bfa;--purple2:#2d1f5e;
        --teal:#22d3ee;
        background:var(--bg);color:var(--text);
        font-family:'Inter',ui-sans-serif,system-ui,sans-serif;
        font-size:14px;line-height:1.6;
        border-radius:12px;
        overflow:hidden;
      }
      .rmc-root .page{max-width:1180px;margin:0 auto;padding:32px 24px}
      .rmc-root .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid var(--border);gap:20px}
      .rmc-root .logo{font-size:22px;font-weight:700;letter-spacing:-.5px}
      .rmc-root .logo span{color:var(--blue)}
      .rmc-root .sub{font-size:11px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase;margin-top:4px}
      .rmc-root .period{font-family:'DM Mono',ui-monospace,monospace;font-size:13px;color:var(--text2);background:var(--bg3);border:1px solid var(--border);padding:6px 14px;border-radius:6px;display:inline-block}
      .rmc-root .generated{font-size:11px;color:var(--text3);margin-top:6px;text-align:right}
      .rmc-root .sl{font-size:10px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin-bottom:14px;display:flex;align-items:center;gap:8px}
      .rmc-root .sl::after{content:'';flex:1;height:1px;background:var(--border)}
      .rmc-root .section{margin-bottom:32px}
      .rmc-root .kpi4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
      .rmc-root .kpi3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}
      @media (max-width: 900px){
        .rmc-root .kpi4,.rmc-root .kpi3{grid-template-columns:repeat(2,1fr)}
        .rmc-root .grid2{grid-template-columns:1fr !important}
        .rmc-root .vs{grid-template-columns:repeat(3,1fr) !important}
      }
      .rmc-root .kpi{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;position:relative;overflow:hidden;min-height:84px}
      .rmc-root .kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent,var(--blue))}
      .rmc-root .kpi .lbl{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
      .rmc-root .kpi .val{font-family:'DM Mono',ui-monospace,monospace;font-size:24px;font-weight:500;line-height:1.1;word-break:break-word}
      .rmc-root .kpi .s{font-size:11px;color:var(--text2);margin-top:5px}
      .rmc-root .kpi.g{--accent:var(--green)}
      .rmc-root .kpi.a{--accent:var(--amber)}
      .rmc-root .kpi.r{--accent:var(--red)}
      .rmc-root .kpi.p{--accent:var(--purple)}
      .rmc-root .kpi.t{--accent:var(--teal)}
      .rmc-root .tw{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden}
      .rmc-root table{width:100%;border-collapse:collapse}
      .rmc-root thead th{background:var(--bg3);font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding:10px 14px;text-align:left;border-bottom:1px solid var(--border)}
      .rmc-root th.r,.rmc-root td.r{text-align:right}
      .rmc-root tbody td{padding:9px 14px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2)}
      .rmc-root tbody td:first-child{color:var(--text);font-weight:500}
      .rmc-root tbody tr:last-child td{border-bottom:none}
      .rmc-root tbody tr:hover td{background:var(--bg3)}
      .rmc-root .m{font-family:'DM Mono',ui-monospace,monospace;font-size:12px}
      .rmc-root .tn{font-size:11px;color:var(--text3);padding:7px 14px;background:var(--bg3);border-top:1px solid var(--border)}
      .rmc-root .pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500}
      .rmc-root .pill.phi{background:#0f3d28;color:#3ecf8e}
      .rmc-root .pill.pmi{background:#1a3a6e;color:#4a8fff}
      .rmc-root .pill.plo{background:#3d2a0a;color:#f5a623}
      .rmc-root .pill.pze{background:#3d1414;color:#ff5e5e}
      .rmc-root .bar-w{display:inline-block;vertical-align:middle;width:52px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-left:6px}
      .rmc-root .bar-f{display:block;height:100%;border-radius:2px}
      .rmc-root .alert{background:var(--amber2);border:1px solid var(--amber);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--amber);margin-top:10px}
      .rmc-root .vc{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:10px}
      .rmc-root .vh{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:var(--bg3);border-bottom:1px solid var(--border)}
      .rmc-root .vn{font-size:13px;font-weight:500;color:var(--text)}
      .rmc-root .vs{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--border)}
      .rmc-root .vst{text-align:center;background:var(--bg2);padding:10px 4px;min-width:0}
      .rmc-root .vsl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px}
      .rmc-root .vsv{font-family:'DM Mono',ui-monospace,monospace;font-size:15px;font-weight:500;margin-top:2px}
      .rmc-root .vd{padding:10px 14px;font-size:12px;color:var(--text3);border-top:1px solid var(--border)}
      .rmc-root .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .rmc-root .grid-title{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
      .rmc-root .footer{margin-top:24px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .rmc-root code{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;background:var(--bg3);padding:1px 5px;border-radius:3px;color:var(--text2)}
    `}</style>
  );
}
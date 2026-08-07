import { useEffect, useMemo, useState } from "react";
import "@/styles/painel-comercial.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/painel/KpiCard";
import { FunnelPanel } from "@/components/painel/FunnelPanel";
import { SellerPerformanceTable } from "@/components/painel/SellerPerformanceTable";
import { ActivityTable } from "@/components/painel/ActivityTable";
import { OriginPanel } from "@/components/painel/OriginPanel";
import { TopProductsGrid } from "@/components/painel/TopProductsGrid";
import {
  usePainelKpis,
  usePainelFunil,
  usePainelVendedores,
  usePainelAtividades,
  usePainelOrigens,
  usePainelTopProdutos,
  usePainelMesesDisponiveis,
  fmtBRL,
  fmtNum,
  fmtPct,
  variacao,
} from "@/hooks/painel/usePainelComercial";

const mesLabel = (iso: string) =>
  new Date(`${iso}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

export default function PainelComercial() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const defaultMes = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const [mesAtual, setMesAtual] = useState(defaultMes);

  // Só oferece meses que existem no cache: o painel lê payloads pré-calculados e
  // um mês nunca calculado abriria a tela inteira vazia, sem distinguir de "sem venda".
  const mesesDisponiveis = usePainelMesesDisponiveis();
  const monthOptions = useMemo(() => {
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const label = (iso: string) => {
      const [ano, mes] = iso.split("-");
      return `${meses[Number(mes) - 1]}/${ano}`;
    };
    const doCache = (mesesDisponiveis.data ?? [])
      .map((m) => String(m.mes).slice(0, 10))
      .filter(Boolean);
    const valores = doCache.includes(defaultMes) ? doCache : [defaultMes, ...doCache];
    return valores.map((value) => ({ value, label: label(value) }));
  }, [mesesDisponiveis.data, defaultMes]);

  const kpis = usePainelKpis(mesAtual);
  const funil = usePainelFunil(mesAtual);
  const vendedores = usePainelVendedores(mesAtual);
  const atividades = usePainelAtividades(mesAtual);
  const origens = usePainelOrigens(mesAtual);
  const produtos = usePainelTopProdutos(mesAtual);

  const k = kpis.data;
  const totalProdutos = k?.receita_produtos_total ?? null;
  const pctEquip =
    totalProdutos && k?.receita_equipamentos != null ? (k.receita_equipamentos / totalProdutos) * 100 : null;
  const pctInsumos =
    totalProdutos && k?.receita_insumos != null ? (k.receita_insumos / totalProdutos) * 100 : null;
  const pctSoftServ =
    totalProdutos && k?.receita_software_servico != null
      ? (k.receita_software_servico / totalProdutos) * 100
      : null;

  return (
    <main className="painel">
      <header className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="pc-logo" aria-hidden>◈</span>
          <div>
            <h1 className="text-2xl font-bold">Painel Comercial — Smart Dent</h1>
            <p className="pc-label mt-1">
              {k?.mes_ref ? mesLabel(k.mes_ref) : "sem dados para este mês"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={mesAtual} onValueChange={setMesAtual}>
            <SelectTrigger className="w-[150px] h-9 text-xs bg-transparent border-white/15 text-inherit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-right">
          <div className="pc-num-sm">
            {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="pc-label">{agora.toLocaleDateString("pt-BR")}</div>
          </div>
        </div>
      </header>

      <div className="pc-legend mb-3">
        <span><i className="pc-dot pc-dot-ok" />dado completo</span>
        <span><i className="pc-dot pc-dot-parcial" />parcial</span>
        <span><i className="pc-dot pc-dot-gap" />sem dado</span>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-3 mb-3">
        <KpiCard
          label="Receita do mês"
          value={fmtBRL(k?.receita_mes, true)}
          status={k?.receita_mes ? "ok" : "gap"}
          delta={variacao(k?.receita_mes, k?.receita_mes_anterior)}
          deltaLabel={
            k?.receita_periodo_comparado
              ? `vs mesmo período (${k.receita_periodo_comparado})`
              : "vs mesmo período do mês anterior"
          }
        />
        <KpiCard
          label="Vs. mês anterior"
          value={
            variacao(k?.receita_mes, k?.receita_mes_anterior) === null
              ? "—"
              : fmtPct(variacao(k?.receita_mes, k?.receita_mes_anterior))
          }
          status={k?.receita_mes_anterior ? "ok" : "gap"}
          tone={(variacao(k?.receita_mes, k?.receita_mes_anterior) ?? 0) >= 0 ? "ok" : "gap"}
          sub={`${k?.receita_periodo_comparado ?? "mês anterior"}: ${fmtBRL(k?.receita_mes_anterior, true)}`}
        />
        <KpiCard
          label="Leads gerados"
          value={fmtNum(k?.leads_mes)}
          status={k?.leads_mes ? "ok" : "gap"}
          delta={variacao(k?.leads_mes, k?.leads_mes_anterior)}
          deltaLabel={
            k?.leads_periodo_comparado
              ? `vs mesmo período (${k.leads_periodo_comparado})`
              : "vs mesmo período do mês anterior"
          }
          tone="info"
        />
        <KpiCard
          label="Leads no funil de vendas"
          value={fmtNum(k?.funil_atual)}
          status={k?.funil_atual ? "ok" : "gap"}
        />
        <KpiCard
          label="Leads perdidos (estagnados)"
          value={fmtNum(k?.leads_perdidos)}
          status={k?.leads_perdidos ? "ok" : "parcial"}
          tone="gap"
        />
        <KpiCard
          label="Leads reativados"
          value={fmtNum(k?.leads_reativados)}
          status={k?.leads_reativados ? "ok" : "parcial"}
          tone="ok"
        />
        <KpiCard
          label="Receita equipamentos"
          value={fmtPct(pctEquip)}
          status={pctEquip === null ? "gap" : "ok"}
          sub={fmtBRL(k?.receita_equipamentos, true)}
        />
        <KpiCard
          label="Receita insumos"
          value={fmtPct(pctInsumos)}
          status={pctInsumos === null ? "gap" : "ok"}
          sub={fmtBRL(k?.receita_insumos, true)}
        />
        <KpiCard
          label="Receita software/serviço"
          value={fmtPct(pctSoftServ)}
          status={pctSoftServ === null ? "gap" : "ok"}
          sub={fmtBRL(k?.receita_software_servico, true)}
        />
      </section>

      {/* A composição só existe para negócios com linhas de proposta; o que fica de
          fora aparece aqui em vez de ser diluído no rateio. */}
      {totalProdutos !== null && (
        <p className="pc-label mb-3">
          Composição calculada sobre {fmtBRL(totalProdutos, true)}
          {k?.receita_mes ? ` (${fmtPct((totalProdutos / k.receita_mes) * 100)} da receita)` : ""}
          {k?.receita_sem_composicao
            ? ` · ${fmtBRL(k.receita_sem_composicao, true)} em negócios sem proposta detalhada`
            : ""}
          {k?.receita_nao_classificada
            ? ` · ${fmtBRL(k.receita_nao_classificada, true)} em itens não classificados`
            : ""}
        </p>
      )}

      <section className="pc-mid-grid mb-3">
        <FunnelPanel rows={funil.data ?? []} />
        <div className="grid grid-cols-1 gap-3 min-w-0">
          <SellerPerformanceTable rows={vendedores.data ?? []} />
          <ActivityTable rows={atividades.data ?? []} periodo={mesLabel(mesAtual.slice(0, 7))} />
        </div>
      </section>

      <section className="mb-3">
        <OriginPanel rows={origens.data ?? []} />
      </section>

      <section className="mb-3">
        <TopProductsGrid rows={produtos.data ?? []} />
      </section>

      <footer className="pc-footer">
        Painel Comercial Smart Dent · dados do Sistema B · atualização automática a cada 5 min
      </footer>
    </main>
  );
}
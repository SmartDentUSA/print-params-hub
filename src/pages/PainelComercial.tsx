import { useEffect, useMemo, useState } from "react";
import "@/styles/painel-comercial.css";
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

  const mesAtual = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  const kpis = usePainelKpis(mesAtual);
  const funil = usePainelFunil();
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

  return (
    <main className="painel">
      <header className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Painel Comercial</h1>
          <p className="pc-label mt-1">{k ? mesLabel(k.mes_ref) : "carregando"}</p>
        </div>
        <div className="text-right">
          <div className="pc-num-sm">
            {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="pc-label">{agora.toLocaleDateString("pt-BR")}</div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-3">
        <KpiCard
          label="Receita do mês"
          value={fmtBRL(k?.receita_mes, true)}
          status={k?.receita_mes ? "ok" : "gap"}
          delta={variacao(k?.receita_mes, k?.receita_mes_anterior)}
          deltaLabel="vs mês anterior"
        />
        <KpiCard
          label="Receita mês anterior"
          value={fmtBRL(k?.receita_mes_anterior, true)}
          status={k?.receita_mes_anterior ? "ok" : "gap"}
        />
        <KpiCard
          label="Leads gerados"
          value={fmtNum(k?.leads_mes)}
          status={k?.leads_mes ? "ok" : "gap"}
          delta={variacao(k?.leads_mes, k?.leads_mes_anterior)}
          deltaLabel="vs mês anterior"
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
      </section>

      <section className="mb-3">
        <FunnelPanel rows={funil.data ?? []} />
      </section>

      <section className="grid grid-cols-1 gap-3 mb-3">
        <SellerPerformanceTable rows={vendedores.data ?? []} />
        <ActivityTable rows={atividades.data ?? []} />
      </section>

      <section className="mb-3">
        <OriginPanel rows={origens.data ?? []} />
      </section>

      <section>
        <TopProductsGrid rows={produtos.data ?? []} />
      </section>
    </main>
  );
}
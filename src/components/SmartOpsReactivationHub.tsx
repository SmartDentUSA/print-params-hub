import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LtvRules } from "./smartops/reactivation/LtvRules";
import { LtvRunsPanel } from "./smartops/reactivation/LtvRunsPanel";
import { OperationalFlowEditor } from "./smartops/reactivation/OperationalFlowEditor";
import { FieldNormalizer } from "./smartops/reactivation/FieldNormalizer";
import { IngestionMap } from "./smartops/reactivation/IngestionMap";
import { CrmRulesMap } from "./smartops/reactivation/CrmRulesMap";
import { ReactivationSettings } from "./smartops/reactivation/ReactivationSettings";

const TAB_HELP: Record<string, { title: string; body: string }> = {
  ltv: {
    title: "Regras LTV",
    body: "Cada regra define quando reabrir um deal LTV após uma venda ganha (D+30, D+60, D+120…), qual template de origem usar, estratégia de vendedor (mesmo dono, round-robin, fixo) e cooldown. O painel de execuções abaixo mostra o que já rodou, o que foi ignorado e por quê.",
  },
  flows: {
    title: "Fluxos Editor",
    body: "Onde os 5 fluxos operacionais (ingestão, deal, nota, LTV, CS) serão editados visualmente no futuro. Hoje eles rodam em modo hardcoded/fallback — este bloco é o placeholder do canvas.",
  },
  ingestion: {
    title: "Ingestão de Leads",
    body: "Mapa de TODAS as fontes que entram em lia_attendances (Meta Ads, formulário SDR, SellFlux, e-commerce, PipeRun, CSV). Mostra qual edge processa cada uma, quais tabelas grava e quais guards aplica.",
  },
  crm: {
    title: "Regras CRM",
    body: "Todos os fluxos que criam ou atualizam Deals no PipeRun. Explica o papel de cada um (Pessoa/Deal, Nota unificada, Reativação LTV, Régua CS, Webhook PipeRun) e os guards de proteção contra duplicação.",
  },
  settings: {
    title: "Configurações",
    body: "Ajustes globais: quais pipelines PipeRun representam VENDAS/CS/LTV, cadências e cooldown default, horário do cron, modo de rollout (direto ou shadow) e chaves-mestres dos guards.",
  },
};

export function SmartOpsReactivationHub() {
  const [tab, setTab] = useState("ltv");
  const help = TAB_HELP[tab];
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="ltv">Regras LTV</TabsTrigger>
        <TabsTrigger value="flows">Fluxos Editor</TabsTrigger>
        <TabsTrigger value="ingestion">Ingestão de Leads</TabsTrigger>
        <TabsTrigger value="crm">Regras CRM</TabsTrigger>
        <TabsTrigger value="normalize">Normalizar Campos</TabsTrigger>
        <TabsTrigger value="settings">Configurações</TabsTrigger>
      </TabsList>
      {help && (
        <div className="rounded-md border border-border/60 bg-muted/40 p-3">
          <p className="text-sm font-medium">{help.title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{help.body}</p>
        </div>
      )}
      <TabsContent value="ltv" className="space-y-4">
        <LtvRules />
        <LtvRunsPanel />
      </TabsContent>
      <TabsContent value="flows"><OperationalFlowEditor /></TabsContent>
      <TabsContent value="ingestion"><IngestionMap /></TabsContent>
      <TabsContent value="crm"><CrmRulesMap /></TabsContent>
      <TabsContent value="normalize"><FieldNormalizer /></TabsContent>
      <TabsContent value="settings"><ReactivationSettings /></TabsContent>
    </Tabs>
  );
}
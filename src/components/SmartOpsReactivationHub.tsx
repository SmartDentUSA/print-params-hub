import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LtvRules } from "./smartops/reactivation/LtvRules";
import { LtvRunsPanel } from "./smartops/reactivation/LtvRunsPanel";
import { FlowEditorPlaceholder } from "./smartops/reactivation/FlowEditorPlaceholder";
import { IngestionMap } from "./smartops/reactivation/IngestionMap";
import { CrmRulesMap } from "./smartops/reactivation/CrmRulesMap";
import { ReactivationSettings } from "./smartops/reactivation/ReactivationSettings";

export function SmartOpsReactivationHub() {
  const [tab, setTab] = useState("ltv");
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="ltv">Regras LTV</TabsTrigger>
        <TabsTrigger value="flows">Fluxos Editor</TabsTrigger>
        <TabsTrigger value="ingestion">Ingestão de Leads</TabsTrigger>
        <TabsTrigger value="crm">Regras CRM</TabsTrigger>
        <TabsTrigger value="settings">Configurações</TabsTrigger>
      </TabsList>
      <TabsContent value="ltv" className="space-y-4">
        <LtvRules />
        <LtvRunsPanel />
      </TabsContent>
      <TabsContent value="flows"><FlowEditorPlaceholder /></TabsContent>
      <TabsContent value="ingestion"><IngestionMap /></TabsContent>
      <TabsContent value="crm"><CrmRulesMap /></TabsContent>
      <TabsContent value="settings"><ReactivationSettings /></TabsContent>
    </Tabs>
  );
}
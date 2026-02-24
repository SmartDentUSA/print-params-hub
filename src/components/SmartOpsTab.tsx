import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { SmartOpsBowtie } from "./SmartOpsBowtie";
import { SmartOpsKanban } from "./SmartOpsKanban";
import { SmartOpsTeam } from "./SmartOpsTeam";
import { SmartOpsCSRules } from "./SmartOpsCSRules";
import { SmartOpsLogs } from "./SmartOpsLogs";
import { SmartOpsReports } from "./SmartOpsReports";
import { SmartOpsLeadsList } from "./SmartOpsLeadsList";

export function SmartOpsTab() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Smart Ops — Centro de Operações</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>

      <Tabs defaultValue="bowtie" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="bowtie">Bowtie</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="reguas">Réguas CS</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="bowtie">
          <SmartOpsBowtie key={`bowtie-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="kanban">
          <SmartOpsKanban key={`kanban-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="leads">
          <SmartOpsLeadsList key={`leads-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="equipe">
          <SmartOpsTeam key={`equipe-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="reguas">
          <SmartOpsCSRules key={`reguas-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="logs">
          <SmartOpsLogs key={`logs-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="relatorios">
          <SmartOpsReports key={`relatorios-${refreshKey}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

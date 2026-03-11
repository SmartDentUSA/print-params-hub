import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Zap, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SmartOpsBowtie } from "./SmartOpsBowtie";
import { SmartOpsAudienceBuilder } from "./SmartOpsAudienceBuilder";
import { SmartOpsTeam } from "./SmartOpsTeam";
import { SmartOpsCSRules } from "./SmartOpsCSRules";
import { SmartOpsLogs } from "./SmartOpsLogs";
import { SmartOpsSystemHealth } from "./SmartOpsSystemHealth";
import { SmartOpsLeadsList } from "./SmartOpsLeadsList";
import { SmartOpsContentProduction } from "./SmartOpsContentProduction";
import { SmartOpsWhatsAppInbox } from "./SmartOpsWhatsAppInbox";
import { SmartOpsFormBuilder } from "./SmartOpsFormBuilder";
import { SmartOpsAIUsageDashboard } from "./SmartOpsAIUsageDashboard";
import { SmartOpsIntelligenceDashboard } from "./SmartOpsIntelligenceDashboard";
import { SmartOpsReports } from "./SmartOpsReports";
import { SmartOpsSmartFlowAnalytics } from "./SmartOpsSmartFlowAnalytics";
import { SmartOpsCopilot } from "./SmartOpsCopilot";


export function SmartOpsTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const handleSyncPipeRun = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("smart-ops-sync-piperun");
      if (error) throw error;
      toast.success("Sync PipeRun iniciado com sucesso");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(`Erro no sync: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Smart Ops — Centro de Operações</h2>
          <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
            <CheckCircle className="w-3 h-3" /> Webhook ativo
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncPipeRun}
            disabled={syncing}
          >
            <Zap className="w-4 h-4 mr-2" />
            {syncing ? "Sincronizando..." : "Sync PipeRun"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar Dados
          </Button>
        </div>
      </div>

      <Tabs defaultValue="bowtie" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start gap-1" style={{ display: 'flex' }}>
          <TabsTrigger value="bowtie">Bowtie</TabsTrigger>
          <TabsTrigger value="kanban">Público / Lista</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="reguas">Automações</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          
          <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
          <TabsTrigger value="saude">Saúde do Sistema</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="formularios">Formulários</TabsTrigger>
          <TabsTrigger value="tokens-ia">Tokens IA</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="roi">ROI</TabsTrigger>
          <TabsTrigger value="copilot">🤖 Copilot</TabsTrigger>
        </TabsList>

        <TabsContent value="bowtie">
          <SmartOpsBowtie key={`bowtie-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="kanban">
          <SmartOpsAudienceBuilder key={`audience-${refreshKey}`} />
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
        <TabsContent value="reports">
          <SmartOpsReports key={`reports-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="conteudo">
          <SmartOpsContentProduction key={`conteudo-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="saude">
          <SmartOpsSystemHealth key={`saude-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="whatsapp">
          <SmartOpsWhatsAppInbox key={`whatsapp-${refreshKey}`} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="formularios">
          <SmartOpsFormBuilder key={`forms-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="tokens-ia">
          <SmartOpsAIUsageDashboard />
        </TabsContent>
        <TabsContent value="intelligence">
          <SmartOpsIntelligenceDashboard key={`intelligence-${refreshKey}`} />
        </TabsContent>
        <TabsContent value="roi">
          <SmartOpsSmartFlowAnalytics />
        </TabsContent>
        <TabsContent value="copilot">
          <SmartOpsCopilot />
        </TabsContent>
      </Tabs>
    </div>
  );
}

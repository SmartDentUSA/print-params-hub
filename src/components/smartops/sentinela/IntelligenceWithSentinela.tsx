import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartOpsIntelligenceDashboard } from "@/components/SmartOpsIntelligenceDashboard";
import { SentinelaTab } from "./SentinelaTab";
import { Shield, Brain } from "lucide-react";

export function IntelligenceWithSentinela() {
  return (
    <Tabs defaultValue="overview" className="space-y-3">
      <TabsList>
        <TabsTrigger value="overview"><Brain className="w-4 h-4 mr-1" /> Visão Geral</TabsTrigger>
        <TabsTrigger value="sentinela"><Shield className="w-4 h-4 mr-1" /> Sentinela</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <SmartOpsIntelligenceDashboard />
      </TabsContent>
      <TabsContent value="sentinela">
        <SentinelaTab />
      </TabsContent>
    </Tabs>
  );
}

export default IntelligenceWithSentinela;
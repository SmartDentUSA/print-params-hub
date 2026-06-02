import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { WaGroupFlowVisualizer } from "@/components/smartops/wa-groups/WaGroupFlowVisualizer";

export default function WaFlowVisualizerPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = params.get("campaign_id");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin?tab=campanhas&sub=grupos-wa")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>
      {campaignId ? (
        <WaGroupFlowVisualizer key={refreshKey} campaignId={campaignId} />
      ) : (
        <p className="text-muted-foreground">Parâmetro <code>?campaign_id=</code> ausente.</p>
      )}
    </div>
  );
}
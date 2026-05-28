import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { WaGroupFlowVisualizer } from "@/components/smartops/wa-groups/WaGroupFlowVisualizer";

export default function WaFlowVisualizerPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = params.get("campaign");

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>
      {campaignId ? (
        <WaGroupFlowVisualizer campaignId={campaignId} />
      ) : (
        <p className="text-muted-foreground">Parâmetro <code>?campaign=</code> ausente.</p>
      )}
    </div>
  );
}
import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export function FlowEditorPlaceholder() {
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <Wrench className="w-8 h-8 mx-auto text-muted-foreground" />
        <h3 className="text-lg font-semibold">Editor Visual de Fluxos</h3>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Motor genérico + canvas ReactFlow em construção. Os 5 fluxos já estão registrados em <code>operational_flows</code> em modo <em>hardcoded</em> (fallback), e as configurações globais controlam o rollout progressivo. O canvas de edição vem no próximo incremento.
        </p>
      </CardContent>
    </Card>
  );
}
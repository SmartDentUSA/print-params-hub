import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Package } from "lucide-react";
import { SmartOpsROICardsManager } from "./SmartOpsROICardsManager";

export function SmartOpsSmartFlowAnalytics() {
  const [showAdmin, setShowAdmin] = useState(false);

  const { data: roiCards = [] } = useQuery({
    queryKey: ["roi-cards-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roi_cards")
        .select("*")
        .eq("status", "publicado")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Smart Flow — Cards ROI
          </h2>
          <p className="text-muted-foreground">Gerencie os cards de ROI publicados na calculadora pública</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdmin(!showAdmin)}>
          {showAdmin ? "Fechar Admin" : "⚙ Gerenciar Cards"}
        </Button>
      </div>

      {/* Admin Panel */}
      {showAdmin && <SmartOpsROICardsManager />}

      {/* Published Cards Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" /> Cards Publicados</CardTitle>
          <CardDescription>{roiCards.length} card(s) visíveis na página pública /calculadora-roi</CardDescription>
        </CardHeader>
        <CardContent>
          {roiCards.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum card publicado. Use "⚙ Gerenciar Cards" acima.</p>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {roiCards.map((c: any) => (
                <div key={c.id} className="rounded-lg border p-3 text-left">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-full h-20 object-contain rounded mb-2" />
                  ) : (
                    <div className="w-full h-20 bg-muted rounded mb-2 flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <Badge variant="outline" className="text-xs mt-1">{c.category}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

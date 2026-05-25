import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, TrendingUp } from "lucide-react";

interface SellerStats {
  name: string;
  whatsapp: string;
  total: number;
  ganhos: number;
  openDeals: number;
  revenue: number;
  avgTicket: number;
  lastLeadDate: string | null;
  conversionRate: number;
}

export function SmartOpsSellerAutomations() {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.rpc("query_seller_performance");
      if (error) {
        console.error("[SellerPerformance]", error);
        setSellers([]);
        setLoading(false);
        return;
      }
      const stats: SellerStats[] = (data || []).map((r: any) => ({
        name: r.name,
        whatsapp: r.whatsapp || "",
        total: Number(r.total_leads || 0),
        ganhos: Number(r.won_deals || 0),
        openDeals: Number(r.open_deals || 0),
        revenue: Number(r.revenue || 0),
        avgTicket: Number(r.avg_ticket || 0),
        conversionRate: Number(r.conversion_rate || 0),
        lastLeadDate: r.last_lead_at,
      }));
      setSellers(stats);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="text-center py-6 text-muted-foreground text-sm">Carregando performance...</div>;
  if (sellers.length === 0) return <div className="text-center py-6 text-muted-foreground text-sm">Nenhum vendedor ativo cadastrado</div>;

  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Performance por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sellers.map((s, i) => (
            <div key={s.name} className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {i === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                  <span className="font-medium text-sm">{s.name}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">{s.whatsapp}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-1.5 rounded bg-muted/50">
                  <div className="text-lg font-bold">{s.total}</div>
                  <div className="text-[10px] text-muted-foreground">Leads</div>
                </div>
                <div className="p-1.5 rounded bg-green-50">
                  <div className="text-lg font-bold text-green-700">{s.ganhos}</div>
                  <div className="text-[10px] text-muted-foreground">Ganhos</div>
                </div>
                <div className="p-1.5 rounded bg-blue-50">
                  <div className="text-lg font-bold text-blue-700">{s.conversionRate.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Conversão</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  Receita 12m: {fmtBRL(s.revenue)}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  Ticket médio: {fmtBRL(s.avgTicket)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Abertos: {s.openDeals}
                </Badge>
              </div>

              {s.lastLeadDate && (
                <div className="text-[10px] text-muted-foreground">
                  Último lead: {new Date(s.lastLeadDate).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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
  byStatus: Record<string, number>;
  lastLeadDate: string | null;
  conversionRate: number;
}

export function SmartOpsSellerAutomations() {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [teamRes, leadsRes] = await Promise.all([
        supabase.from("team_members").select("nome_completo, whatsapp_number").eq("ativo", true).eq("role", "vendedor"),
        supabase.from("lia_attendances").select("proprietario_lead_crm, lead_status, status_atual_lead_crm, created_at").limit(1000),
      ]);

      const team = teamRes.data || [];
      const leads = leadsRes.data || [];

      const stats: SellerStats[] = team.map((t) => {
        const myLeads = leads.filter((l) => l.proprietario_lead_crm === t.nome_completo);
        const byStatus: Record<string, number> = {};
        myLeads.forEach((l) => {
          byStatus[l.lead_status] = (byStatus[l.lead_status] || 0) + 1;
        });
        const ganhos = myLeads.filter((l) => l.status_atual_lead_crm === "Ganha").length;
        const dates = myLeads.map((l) => l.created_at).sort().reverse();

        return {
          name: t.nome_completo,
          whatsapp: t.whatsapp_number,
          total: myLeads.length,
          ganhos,
          byStatus,
          lastLeadDate: dates[0] || null,
          conversionRate: myLeads.length > 0 ? (ganhos / myLeads.length) * 100 : 0,
        };
      });

      stats.sort((a, b) => b.conversionRate - a.conversionRate);
      setSellers(stats);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="text-center py-6 text-muted-foreground text-sm">Carregando performance...</div>;
  if (sellers.length === 0) return <div className="text-center py-6 text-muted-foreground text-sm">Nenhum vendedor ativo cadastrado</div>;

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
                {Object.entries(s.byStatus).map(([status, count]) => (
                  <Badge key={status} variant="secondary" className="text-[9px]">
                    {status}: {count}
                  </Badge>
                ))}
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

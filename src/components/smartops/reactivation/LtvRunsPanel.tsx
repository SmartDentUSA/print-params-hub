import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Run {
  id: string;
  rule_id: string;
  source_deal_id: string;
  trigger_day: number;
  new_deal_id: string | null;
  status: string;
  skip_reason: string | null;
  dry_run: boolean;
  triggered_at: string;
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  created: "default",
  won: "default",
  pending: "secondary",
  skipped: "outline",
  lost: "outline",
  error: "destructive",
};

export function LtvRunsPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("ltv_reactivation_runs").select("*").order("triggered_at", { ascending: false }).limit(100);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    setRuns((data ?? []) as any as Run[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Últimas execuções</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="created">Criados</SelectItem>
              <SelectItem value="skipped">Ignorados</SelectItem>
              <SelectItem value="won">Ganhos</SelectItem>
              <SelectItem value="lost">Perdidos</SelectItem>
              <SelectItem value="error">Erros</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
        ) : (
          <div className="text-xs">
            <div className="grid grid-cols-6 gap-2 pb-2 font-semibold text-muted-foreground border-b">
              <span>Quando</span>
              <span>Trigger</span>
              <span>Deal origem</span>
              <span>Novo deal</span>
              <span>Status</span>
              <span>Motivo</span>
            </div>
            {runs.map((r) => (
              <div key={r.id} className="grid grid-cols-6 gap-2 py-1.5 border-b last:border-0">
                <span>{new Date(r.triggered_at).toLocaleString("pt-BR")}</span>
                <span>D+{r.trigger_day}</span>
                <span className="truncate font-mono">{r.source_deal_id}</span>
                <span className="truncate font-mono">{r.new_deal_id ?? "—"}</span>
                <span>
                  <Badge variant={statusVariant[r.status] ?? "outline"}>{r.status}</Badge>
                  {r.dry_run && <Badge variant="secondary" className="ml-1">dry</Badge>}
                </span>
                <span className="truncate text-muted-foreground">{r.skip_reason ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
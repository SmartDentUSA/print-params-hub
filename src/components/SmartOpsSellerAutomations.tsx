import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";

interface SellerStats {
  member_id: string;
  nome_completo: string;
  deals_total: number;
  deals_ganhos: number;
  receita: number;
  conversao: number;
  ultimo_ganho: string | null;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function SmartOpsSellerAutomations() {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("fn_team_seller_stats", { _months: 12 });
      setSellers(((data as SellerStats[]) || []).map((s) => ({
        ...s,
        deals_total: Number(s.deals_total),
        deals_ganhos: Number(s.deals_ganhos),
        receita: Number(s.receita),
        conversao: Number(s.conversao),
      })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-center py-6 text-muted-foreground text-sm">Carregando performance...</div>;
  if (sellers.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Performance por vendedor
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Negócios do PipeRun dos últimos 12 meses, vinculados pelo ID do vendedor.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Negócios</TableHead>
              <TableHead className="text-right">Ganhos</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
              <TableHead className="text-right">Último ganho</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map((s) => (
              <TableRow key={s.member_id}>
                <TableCell className="font-medium">{s.nome_completo}</TableCell>
                <TableCell className="text-right">{s.deals_total}</TableCell>
                <TableCell className="text-right">{s.deals_ganhos}</TableCell>
                <TableCell className="text-right">{brl(s.receita)}</TableCell>
                <TableCell className="text-right">{s.conversao.toFixed(1)}%</TableCell>
                <TableCell className="text-right text-muted-foreground text-xs">
                  {s.ultimo_ganho ? new Date(s.ultimo_ganho).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

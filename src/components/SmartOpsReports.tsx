import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Download, Users, AlertTriangle, TrendingDown } from "lucide-react";

interface Client {
  id: string;
  nome: string;
  email: string;
  data_contrato: string | null;
  ativo_scan: boolean;
  ativo_notebook: boolean;
  ativo_cad: boolean;
  ativo_cad_ia: boolean;
  ativo_smart_slice: boolean;
  ativo_print: boolean;
  ativo_cura: boolean;
  ativo_insumos: boolean;
  data_ultima_compra_insumos: string | null;
}

const ASSETS = ["scan", "notebook", "cad", "cad_ia", "smart_slice", "print", "cura", "insumos"] as const;

export function SmartOpsReports() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, data_contrato, ativo_scan, ativo_notebook, ativo_cad, ativo_cad_ia, ativo_smart_slice, ativo_print, ativo_cura, ativo_insumos, data_ultima_compra_insumos")
        .not("data_contrato", "is", null)
        .order("data_contrato", { ascending: false })
        .limit(500);
      setClients((data as Client[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const totalAtivos = clients.length;
  const churnPotencial = clients.filter((c) => {
    if (!c.data_ultima_compra_insumos) return true;
    return new Date(c.data_ultima_compra_insumos) < ninetyDaysAgo;
  }).length;
  const gapAtivos = clients.filter((c) => {
    const ativos = ASSETS.filter((a) => c[`ativo_${a}` as keyof Client] === true).length;
    return ativos >= 1 && ativos < 4;
  }).length;

  const exportCSV = () => {
    const header = "Nome,Email,Contrato," + ASSETS.join(",") + ",Ultima Compra Insumos\n";
    const rows = clients.map((c) =>
      [c.nome, c.email, c.data_contrato || "", ...ASSETS.map((a) => c[`ativo_${a}` as keyof Client] ? "Sim" : "Não"), c.data_ultima_compra_insumos || ""].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-ops-recorrencia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando relatórios...</div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{totalAtivos}</div>
              <div className="text-sm text-muted-foreground">Clientes Ativos</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-destructive" />
            <div>
              <div className="text-2xl font-bold">{churnPotencial}</div>
              <div className="text-sm text-muted-foreground">Churn Potencial</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold">{gapAtivos}</div>
              <div className="text-sm text-muted-foreground">Gap de Ativos</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Detalhamento por Cliente</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  {ASSETS.map((a) => <TableHead key={a} className="text-xs text-center">{a.replace("_", " ").toUpperCase()}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.slice(0, 50).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.nome}</TableCell>
                    <TableCell className="text-xs">{c.email}</TableCell>
                    {ASSETS.map((a) => (
                      <TableCell key={a} className="text-center">
                        {c[`ativo_${a}` as keyof Client] ? (
                          <Badge className="bg-green-600 text-white text-xs">✓</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">—</Badge>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Download, Users, AlertTriangle, TrendingDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// CORREÇÃO 5: Use stage_name instead of stage_id
interface DealRow {
  id: string;
  stage_name: string;
  status: string;
  value: number | null;
  piperun_created_at: string | null;
  owner_name: string | null;
  product: string | null;
  lead_id: string | null;
}

interface LeadInfo {
  nome: string | null;
  email: string | null;
  telefone_normalized: string | null;
  cidade: string | null;
  uf: string | null;
  anchor_product: string | null;
}

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

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function SmartOpsReports() {
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<(DealRow & { lead?: LeadInfo })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAll = async () => {
      // Clients (existing)
      const clientsPromise = supabase
        .from("lia_attendances")
        .select("id, nome, email, data_contrato, ativo_scan, ativo_notebook, ativo_cad, ativo_cad_ia, ativo_smart_slice, ativo_print, ativo_cura, ativo_insumos, data_ultima_compra_insumos")
        .not("data_contrato", "is", null)
        .order("data_contrato", { ascending: false })
        .limit(500);

      // CORREÇÃO 5: Deals by stage_name with lead join
      const dealsPromise = supabase
        .from("deals")
        .select("id, stage_name, status, value, piperun_created_at, owner_name, product, lead_id")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .not("stage_name", "is", null)
        .order("piperun_created_at", { ascending: false })
        .limit(100);

      const [clientsRes, dealsRes] = await Promise.all([clientsPromise, dealsPromise]);

      setClients((clientsRes.data as Client[]) || []);

      // Enrich deals with lead info
      const rawDeals = (dealsRes.data as DealRow[]) || [];
      const leadIds = [...new Set(rawDeals.map((d) => d.lead_id).filter(Boolean))];

      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("lia_attendances")
          .select("id, nome, email, telefone_normalized, cidade, uf, anchor_product")
          .in("id", leadIds.slice(0, 100));

        const leadMap = new Map<string, LeadInfo>();
        (leads || []).forEach((l: any) => leadMap.set(l.id, l));

        setDeals(rawDeals.map((d) => ({ ...d, lead: d.lead_id ? leadMap.get(d.lead_id) || undefined : undefined })));
      } else {
        setDeals(rawDeals);
      }

      setLoading(false);
    };
    fetchAll();
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

  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const allRows: Record<string, unknown>[] = [];
      const BATCH = 1000;
      let offset = 0;
      let done = false;

      while (!done) {
        const { data, error } = await supabase
          .from("lia_attendances")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + BATCH - 1);

        if (error) throw error;
        if (!data || data.length === 0) { done = true; break; }
        allRows.push(...data);
        if (data.length < BATCH) { done = true; } else { offset += BATCH; }
      }

      if (allRows.length === 0) {
        toast({ title: "Nenhum lead encontrado", variant: "destructive" });
        return;
      }

      const headerSet = new Set<string>();
      allRows.forEach(row => Object.keys(row).forEach(k => headerSet.add(k)));
      const headers = Array.from(headerSet);

      const escapeCSV = (val: unknown): string => {
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvLines = [
        headers.join(","),
        ...allRows.map((row) => headers.map((h) => escapeCSV(row[h])).join(","))
      ];

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smart-ops-leads-completo-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: `${allRows.length} leads exportados com ${headers.length} campos` });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Erro na exportação", description: String(err), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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

      {/* CORREÇÃO 5: Detalhamento por Cliente (deals by stage_name) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Detalhamento por Cliente (Deals Recentes)</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            {isExporting ? "Exportando..." : "Exportar CSV Completo"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">
                      {d.lead?.nome || "—"}
                      {d.lead?.email && <div className="text-xs text-muted-foreground">{d.lead.email}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{d.lead?.anchor_product || d.product || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{d.stage_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        d.status === "ganha" ? "bg-green-600 text-white" :
                        d.status === "perdida" ? "bg-red-600 text-white" :
                        "bg-blue-600 text-white"
                      }>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {d.value ? formatBRL(d.value) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{d.owner_name || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {[d.lead?.cidade, d.lead?.uf].filter(Boolean).join("/") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.piperun_created_at ? new Date(d.piperun_created_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {deals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum deal encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Original client detail table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Cliente (Ativos)</CardTitle>
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

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Cpu, Search, Webhook, Clock, Zap } from "lucide-react";

interface CatalogRow {
  id: string;
  function_name: string;
  category: string;
  summary: string;
  trigger_type: string;
  is_critical: boolean;
  deprecated: boolean;
  invocations_24h: number | null;
  errors_24h: number | null;
  avg_latency_ms: number | null;
  last_invocation_at: string | null;
}

const TRIGGER_ICON: Record<string, typeof Webhook> = {
  webhook: Webhook,
  cron: Clock,
  http: Zap,
  internal: Cpu,
};

export function EdgeFunctionsCatalog() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("__all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("edge_function_catalog" as never)
        .select("*")
        .order("category", { ascending: true })
        .order("function_name", { ascending: true });
      setRows((data ?? []) as unknown as CatalogRow[]);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(rows.map((r) => r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "__all" && r.category !== category) return false;
      if (q && !r.function_name.toLowerCase().includes(q) && !r.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, category, search]);

  const grouped = useMemo(() => {
    const m: Record<string, CatalogRow[]> = {};
    for (const r of filtered) (m[r.category] ??= []).push(r);
    return m;
  }, [filtered]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      critical: rows.filter((r) => r.is_critical).length,
      webhooks: rows.filter((r) => r.trigger_type === "webhook").length,
      crons: rows.filter((r) => r.trigger_type === "cron").length,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Catálogo de Edge Functions</h3>
          <Badge variant="outline">{stats.total} funções</Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{stats.critical} críticas</Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{stats.webhooks} webhooks</Badge>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{stats.crons} crons</Badge>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas as categorias</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4" /> {cat}
                <Badge variant="outline" className="ml-1">{list.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Trigger</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>O que faz</TableHead>
                      <TableHead className="text-center">Crítica</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((r) => {
                      const Icon = TRIGGER_ICON[r.trigger_type] ?? Zap;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <span title={r.trigger_type}>
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{r.function_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.summary}</TableCell>
                          <TableCell className="text-center">
                            {r.is_critical && <Badge variant="destructive" className="text-[10px]">crítica</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
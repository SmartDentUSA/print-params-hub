import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeadDetailPanel } from "./smartops/LeadDetailPanel";
import { Printer, Search, RefreshCw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Category = "recomprou" | "critico" | "atencao" | "cedo";

interface Owner {
  lead_id: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  printer_date_iso: string | null;
  days_since: number;
  vendor: string;
  printer_price: number;
  printer_deal_id: string | null;
  n_post: number;
  total_post: number;
  first_repurchase_days: number | null;
  category: Category;
}

const CATEGORY_META: Record<Category, { label: string; classes: string }> = {
  recomprou: { label: "✅ Recomprou", classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  critico:   { label: "🔴 Crítico",   classes: "bg-red-500/10 text-red-400 border-red-500/30" },
  atencao:   { label: "🟡 Atenção",   classes: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  cedo:      { label: "⚪ Cedo",      classes: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
};

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function SmartOpsRayshape() {
  const { toast } = useToast();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const { data, error } = await supabase.rpc("fn_rayshape_owners" as any);
    if (error) {
      toast({ title: "Erro ao carregar Rayshape", description: error.message, variant: "destructive" });
    } else {
      setOwners((data as any) || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Realtime: any deal change reloads (debounced)
  useEffect(() => {
    let t: any;
    const ch = supabase
      .channel("rayshape-owners")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => {
        clearTimeout(t);
        t = setTimeout(() => load(true), 1500);
      })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [load]);

  const kpis = useMemo(() => {
    const total = owners.length;
    const recomp = owners.filter(o => o.category === "recomprou").length;
    const critic = owners.filter(o => o.category === "critico").length;
    const sumPost = owners.reduce((a, o) => a + (o.total_post || 0), 0);
    const avgTicket = recomp ? sumPost / recomp : 0;
    return { total, recomp, critic, avgTicket, pctRecomp: total ? Math.round((recomp / total) * 100) : 0 };
  }, [owners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return owners.filter(o => {
      if (filter !== "all" && o.category !== filter) return false;
      if (!q) return true;
      return [o.lead_name, o.lead_email, o.lead_phone, o.vendor]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [owners, search, filter]);

  const openLead = async (leadId: string) => {
    setOpening(true);
    const { data, error } = await supabase
      .from("lia_attendances")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();
    setOpening(false);
    if (error || !data) {
      toast({ title: "Erro ao abrir lead", description: error?.message || "Não encontrado", variant: "destructive" });
      return;
    }
    setSelectedLead(data);
  };

  if (selectedLead) {
    return <LeadDetailPanel lead={selectedLead as any} onClose={() => setSelectedLead(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Rayshape — Donos Edge Mini</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Donos totais</div>
          <div className="text-2xl font-semibold text-foreground">{kpis.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Recompraram</div>
          <div className="text-2xl font-semibold text-emerald-400">{kpis.recomp} <span className="text-sm text-muted-foreground">({kpis.pctRecomp}%)</span></div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Críticos (180d+)</div>
          <div className="text-2xl font-semibold text-red-400">{kpis.critic}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ticket médio recompra</div>
          <div className="text-2xl font-semibold text-foreground">{fmtBRL(kpis.avgTicket)}</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, telefone ou vendedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {(["all", "critico", "atencao", "cedo", "recomprou"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {k === "all" ? "Todos" : CATEGORY_META[k].label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhum dono encontrado com esses filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Lead</th>
                  <th className="text-left p-3">Vendedor</th>
                  <th className="text-left p-3">Comprou em</th>
                  <th className="text-right p-3">Dias</th>
                  <th className="text-right p-3">Recompras</th>
                  <th className="text-right p-3">Total recompra</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.lead_id}
                    onClick={() => openLead(o.lead_id)}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-medium text-foreground">{o.lead_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.lead_email || o.lead_phone || ""}</div>
                    </td>
                    <td className="p-3 text-foreground/80">{o.vendor || "—"}</td>
                    <td className="p-3 text-foreground/80">{fmtDate(o.printer_date_iso)}</td>
                    <td className="p-3 text-right text-foreground/80">{o.days_since}d</td>
                    <td className="p-3 text-right text-foreground/80">{o.n_post}</td>
                    <td className="p-3 text-right text-foreground/80">{fmtBRL(o.total_post)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={CATEGORY_META[o.category].classes}>
                        {CATEGORY_META[o.category].label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {opening && (
          <div className="p-3 flex items-center justify-center text-xs text-muted-foreground border-t border-border">
            <Loader2 className="w-3 h-3 animate-spin mr-1" /> Abrindo lead…
          </div>
        )}
      </Card>
    </div>
  );
}
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeadDetailPanel } from "./smartops/LeadDetailPanel";
import "@/styles/intelligence-dark.css";
import { Printer, Search, RefreshCw, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Category = "recomprou" | "critico" | "atencao" | "cedo";
type SaleKind = "separado" | "combo";
type FilterKey = Category | SaleKind | "all";

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
  first_repurchase_product?: string | null;
  first_repurchase_qty?: number | null;
  last_repurchase_iso: string | null;
  category: Category;
  source?: "auto" | "manual";
  sale_kind?: SaleKind;
  edge_purchase_at?: string | null;
  recompra_combo_brl?: number;
  recompra_separado_brl?: number;
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

// Normaliza nomes de produtos para exibição/agrupamento.
// Regras case-insensitive; retorna o mesmo texto se nada bater.
const PRODUCT_NAME_RULES: { pattern: RegExp; label: string }[] = [
  { pattern: /model\s*plus/i, label: "Resina 3D Smart Print Model Plus" },
];
function normalizeProductName(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "";
  for (const r of PRODUCT_NAME_RULES) if (r.pattern.test(s)) return r.label;
  return s;
}

export function SmartOpsRayshape() {
  const { toast } = useToast();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [productUnits, setProductUnits] = useState<{ product_key: string; product_label: string; units: number; leads: number; ord: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [opening, setOpening] = useState(false);

  // Manual add
  const [addOpen, setAddOpen] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadLabel, setSelectedLeadLabel] = useState<string>("");
  const [printerDate, setPrinterDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dealId, setDealId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const [ownersRes, unitsRes] = await Promise.all([
      supabase.rpc("fn_rayshape_owners" as any),
      supabase.rpc("fn_rayshape_product_units" as any),
    ]);
    if (ownersRes.error) {
      toast({ title: "Erro ao carregar Rayshape", description: ownersRes.error.message, variant: "destructive" });
    } else {
      setOwners((ownersRes.data as any) || []);
    }
    if (unitsRes.error) {
      // silent — KPI section will just be empty
      console.warn("fn_rayshape_product_units error", unitsRes.error.message);
    } else {
      setProductUnits(((unitsRes.data as any) || []).map((r: any) => ({
        product_key: r.product_key,
        product_label: r.product_label,
        units: Number(r.units) || 0,
        leads: Number(r.leads) || 0,
        ord: Number(r.ord) || 0,
      })));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "rayshape_manual_owners" }, () => {
        clearTimeout(t);
        t = setTimeout(() => load(true), 800);
      })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [load]);

  const kpis = useMemo(() => {
    const total = owners.length;
    const recomp = owners.filter(o => o.category === "recomprou").length;
    const critic = owners.filter(o => o.category === "critico").length;
    const separados = owners.filter(o => o.sale_kind === "separado").length;
    const combos    = owners.filter(o => o.sale_kind === "combo").length;
    const sumPost = owners.reduce((a, o) => a + (o.total_post || 0), 0);
    const avgTicket = recomp ? sumPost / recomp : 0;
    const recompraCombo    = owners.reduce((a, o) => a + (o.recompra_combo_brl || 0), 0);
    const recompraSeparado = owners.reduce((a, o) => a + (o.recompra_separado_brl || 0), 0);
    const firstDaysArr = owners
      .map(o => o.first_repurchase_days)
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgFirstDays = firstDaysArr.length
      ? Math.round(firstDaysArr.reduce((a, b) => a + b, 0) / firstDaysArr.length)
      : 0;
    // Agrupa produtos da 1ª recompra com nome normalizado; soma leads e unidades.
    const bucket = new Map<string, { label: string; leads: number; units: number }>();
    for (const o of owners) {
      const label = normalizeProductName(o.first_repurchase_product);
      if (!label) continue;
      const cur = bucket.get(label) || { label, leads: 0, units: 0 };
      cur.leads += 1;
      cur.units += Number(o.first_repurchase_qty) || 0;
      bucket.set(label, cur);
    }
    const topProducts = Array.from(bucket.values()).sort(
      (a, b) => b.leads - a.leads || b.units - a.units,
    );
    return {
      total, recomp, critic, separados, combos, avgTicket, recompraCombo, recompraSeparado,
      avgFirstDays, firstDaysCount: firstDaysArr.length,
      topProducts,
      pctRecomp: total ? Math.round((recomp / total) * 100) : 0,
    };
  }, [owners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return owners.filter(o => {
      if (filter === "separado" || filter === "combo") {
        if (o.sale_kind !== filter) return false;
      } else if (filter !== "all" && o.category !== filter) {
        return false;
      }
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

  // Debounced lead search for manual add
  useEffect(() => {
    if (!addOpen) return;
    const q = leadQuery.trim();
    if (q.length < 2) { setLeadResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, telefone_normalized")
        .is("merged_into", null)
        .or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone_normalized.ilike.%${q}%`)
        .limit(10);
      setLeadResults((data as any[]) || []);
    }, 300);
    return () => clearTimeout(t);
  }, [leadQuery, addOpen]);

  const resetAddForm = () => {
    setLeadQuery(""); setLeadResults([]); setSelectedLeadId(null); setSelectedLeadLabel("");
    setPrinterDate(new Date().toISOString().slice(0, 10)); setDealId(""); setNote("");
  };

  const saveManual = async () => {
    if (!selectedLeadId || !printerDate) {
      toast({ title: "Selecione um lead e a data", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("rayshape_manual_owners" as any).insert({
      lead_id: selectedLeadId,
      printer_date: printerDate,
      piperun_deal_id: dealId.trim() || null,
      note: note.trim() || null,
      created_by: user?.id || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dono adicionado", description: selectedLeadLabel });
    setAddOpen(false);
    resetAddForm();
    load(true);
  };

  const removeManual = async (leadId: string) => {
    if (!confirm("Remover este dono manual da lista?")) return;
    const { error } = await supabase
      .from("rayshape_manual_owners" as any)
      .delete()
      .eq("lead_id", leadId);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    load(true);
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
          <h2 className="text-lg font-semibold text-foreground">Impressora 3D Rayshape Edge Mini — Donos</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar manualmente
          </Button>
          <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Donos totais</div>
          <div className="text-2xl font-semibold text-foreground">{kpis.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vendidos separadamente</div>
          <div className="text-2xl font-semibold text-sky-400">{kpis.separados}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Combo</div>
          <div className="text-2xl font-semibold text-purple-400">{kpis.combos}</div>
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
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Recompra Combo</div>
          <div className="text-2xl font-semibold text-purple-400">{fmtBRL(kpis.recompraCombo)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Recompra Separado</div>
          <div className="text-2xl font-semibold text-sky-400">{fmtBRL(kpis.recompraSeparado)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Média p/ 1ª recompra</div>
          <div className="text-2xl font-semibold text-foreground">
            {kpis.firstDaysCount ? `${kpis.avgFirstDays}d` : "—"}
            {kpis.firstDaysCount ? <span className="text-sm text-muted-foreground"> ({kpis.firstDaysCount})</span> : null}
          </div>
        </Card>
        {[
          { title: "Produto principal na 1ª compra", idx: 0 },
          { title: "2º produto mais comprado na 1ª compra", idx: 1 },
          { title: "3º produto mais comprado na 1ª compra", idx: 2 },
        ].map(({ title, idx }) => {
          const p = kpis.topProducts[idx];
          return (
            <Card key={idx} className={`p-4 ${p ? "" : "opacity-50"}`}>
              <div className="text-xs text-muted-foreground">{title}</div>
              <div
                className="text-base font-semibold text-foreground leading-tight line-clamp-2"
                title={p?.label || "—"}
              >
                {p?.label || "—"}
              </div>
              {p ? (
                <div className="text-xs text-muted-foreground mt-1">
                  {p.units.toLocaleString("pt-BR")} un. · {p.leads} lead{p.leads !== 1 ? "s" : ""}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      {/* Unidades vendidas por produto (pós-impressora) */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Unidades vendidas — pós-compra da impressora</h3>
          <span className="text-xs text-muted-foreground">
            Total: {productUnits.reduce((a, p) => a + p.units, 0).toLocaleString("pt-BR")} un.
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...productUnits]
            .sort((a, b) => b.units - a.units || a.ord - b.ord)
            .map((p) => {
              const zero = p.units === 0;
              return (
                <Card key={p.product_key} className={`p-3 ${zero ? "opacity-50" : ""}`}>
                  <div
                    className="text-[11px] text-muted-foreground leading-tight line-clamp-2 min-h-[28px]"
                    title={p.product_label}
                  >
                    {p.product_label}
                  </div>
                  <div className={`text-2xl font-semibold ${zero ? "text-muted-foreground" : "text-emerald-400"}`}>
                    {p.units.toLocaleString("pt-BR")}
                    <span className="text-xs text-muted-foreground font-normal ml-1">un.</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.leads} lead{p.leads !== 1 ? "s" : ""}
                  </div>
                </Card>
              );
            })}
        </div>
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
        {(["all", "separado", "combo", "critico", "atencao", "cedo", "recomprou"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {k === "all"
              ? "Todos"
              : k === "separado"
                ? "Separado"
                : k === "combo"
                  ? "Combo"
                  : CATEGORY_META[k as Category].label}
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
                  <th className="text-left p-3">Última recompra</th>
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
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {o.lead_name || "—"}
                        {o.sale_kind === "combo" && (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px]">combo</Badge>
                        )}
                        {o.sale_kind === "separado" && (
                          <Badge variant="outline" className="bg-sky-500/10 text-sky-300 border-sky-500/30 text-[10px]">separado</Badge>
                        )}
                        {o.source === "manual" && (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px]">manual</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{o.lead_email || o.lead_phone || ""}</div>
                    </td>
                    <td className="p-3 text-foreground/80">{o.vendor || "—"}</td>
                    <td className="p-3 text-foreground/80">{fmtDate(o.printer_date_iso)}</td>
                    <td className="p-3 text-right text-foreground/80">{o.days_since}d</td>
                    <td className="p-3 text-right text-foreground/80">{o.n_post}</td>
                    <td className="p-3 text-foreground/80">{fmtDate(o.last_repurchase_iso)}</td>
                    <td className="p-3 text-right text-foreground/80">{fmtBRL(o.total_post)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={CATEGORY_META[o.category].classes}>
                          {CATEGORY_META[o.category].label}
                        </Badge>
                        {o.source === "manual" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeManual(o.lead_id); }}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                            title="Remover dono manual"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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

      {/* Add manual owner dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar dono — Impressora 3D Rayshape Edge Mini</DialogTitle>
            <DialogDescription>
              Use para registrar combos (ex.: INO 200) que incluem a impressora Rayshape mas não a desmembram na proposta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lead</Label>
              {selectedLeadId ? (
                <div className="flex items-center justify-between rounded border border-border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-foreground">{selectedLeadLabel}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedLeadId(null); setSelectedLeadLabel(""); }}>Trocar</Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar por nome, e-mail ou telefone…"
                    value={leadQuery}
                    onChange={(e) => setLeadQuery(e.target.value)}
                  />
                  {leadResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded border border-border divide-y divide-border">
                      {leadResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setSelectedLeadId(r.id);
                            setSelectedLeadLabel(`${r.nome || "(sem nome)"} — ${r.email || r.telefone_normalized || ""}`);
                            setLeadResults([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/30"
                        >
                          <div className="text-foreground">{r.nome || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.email || r.telefone_normalized || ""}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data da impressora</Label>
                <Input type="date" value={printerDate} onChange={(e) => setPrinterDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Deal PipeRun (opcional)</Label>
                <Input placeholder="Ex.: 47317858" value={dealId} onChange={(e) => setDealId(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nota</Label>
              <Textarea
                placeholder="Ex.: combo INO 200 + Edge Mini embutida (confirmado por Sicilia)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveManual} disabled={saving || !selectedLeadId}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
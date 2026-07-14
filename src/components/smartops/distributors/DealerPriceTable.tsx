import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Trash2, Plus, ImageOff, FileSpreadsheet, FileText, FileType, History, Save } from "lucide-react";
import { toast } from "sonner";
import type { DealerPriceItem, DealerPriceList, Distributor, DealerSnapshot } from "./types";
import { recalcDealerPrice, recalcDiscount, formatMoney, PRESENTATION_OPTIONS } from "./types";
import { exportPriceTableXlsx, exportPriceTablePdf, exportPriceTableDocx } from "./DealerProposalExport";

type Props = { distributors: Distributor[]; onGenerateProposal?: (list: DealerPriceList, items: DealerPriceItem[]) => void };

export function DealerPriceTable({ distributors, onGenerateProposal }: Props) {
  const [distributorId, setDistributorId] = useState<string>("");
  const [list, setList] = useState<DealerPriceList | null>(null);
  const [items, setItems] = useState<DealerPriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [snapshots, setSnapshots] = useState<DealerSnapshot[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const distributor = distributors.find((d) => d.id === distributorId);
  const currency = list?.currency || distributor?.preferred_currency || "BRL";

  const loadOrCreate = async (distId: string) => {
    setLoading(true);
    const dist = distributors.find((d) => d.id === distId);
    let { data: lists } = await supabase
      .from("dealer_price_lists" as any)
      .select("*")
      .eq("distributor_id", distId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1);
    let l = (lists as any)?.[0];
    if (!l) {
      const { data: created, error } = await supabase
        .from("dealer_price_lists" as any)
        .insert({
          distributor_id: distId,
          name: "Tabela padrão",
          currency: dist?.preferred_currency || "BRL",
          language: dist?.language_preference || "pt",
        })
        .select("*")
        .single();
      if (error) { toast.error("Erro ao criar tabela: " + error.message); setLoading(false); return; }
      l = created;
    }
    setList(l as DealerPriceList);
    const { data: rows } = await supabase
      .from("dealer_price_items" as any)
      .select("*")
      .eq("price_list_id", l.id)
      .order("category", { ascending: true })
      .order("subcategory", { ascending: true })
      .order("sort_order", { ascending: true });
    setItems(((rows as any) || []) as DealerPriceItem[]);
    setDirtyIds(new Set());
    // Carrega histórico de snapshots
    const { data: snaps } = await supabase
      .from("dealer_price_list_snapshots" as any)
      .select("id,distributor_id,price_list_id,label,currency,language,items,totals,created_at")
      .eq("distributor_id", distId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSnapshots(((snaps as any) || []) as DealerSnapshot[]);
    setLoading(false);
  };

  useEffect(() => {
    if (distributorId) loadOrCreate(distributorId);
    else { setList(null); setItems([]); }
  }, [distributorId]);

  const importCatalog = async () => {
    if (!list) return;
    setLoading(true);
    const { data: cat, error } = await supabase
      .from("system_a_catalog" as any)
      .select("id,name,name_en,name_es,image_url,product_category,product_subcategory,description,price,currency")
      .eq("active", true);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const existing = new Set(items.map((i) => i.catalog_product_id).filter(Boolean) as string[]);
    const toInsert = ((cat as any) || [])
      .filter((p: any) => !existing.has(p.id))
      .map((p: any, idx: number) => ({
        price_list_id: list.id,
        catalog_product_id: p.id,
        cod: null,
        name: p.name,
        name_en: p.name_en,
        name_es: p.name_es,
        image_url: p.image_url,
        category: p.product_category,
        subcategory: p.product_subcategory,
        description: p.description,
        price_base: Number(p.price) || 0,
        discount_pct: 0,
        price_dealer: Number(p.price) || 0,
        unidade: "UN",
        presentation: "Unit",
        quantity_multiplier: 1,
        sort_order: items.length + idx,
      }));
    if (toInsert.length === 0) { toast.info("Todos os produtos do catálogo já estão na tabela."); setLoading(false); return; }
    const { error: insErr } = await supabase.from("dealer_price_items" as any).insert(toInsert);
    if (insErr) toast.error(insErr.message);
    else toast.success(`${toInsert.length} produtos importados`);
    await loadOrCreate(distributorId);
  };

  const updateField = (id: string, field: keyof DealerPriceItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next: DealerPriceItem = { ...it, [field]: value } as any;
        if (field === "price_base" || field === "discount_pct") {
          next.price_dealer = recalcDealerPrice(Number(next.price_base), Number(next.discount_pct));
        } else if (field === "price_dealer") {
          next.discount_pct = recalcDiscount(Number(next.price_base), Number(next.price_dealer));
        }
        return next;
      }),
    );
    setDirtyIds((s) => new Set(s).add(id));
  };

  const saveAll = async () => {
    if (!list || dirtyIds.size === 0) return;
    setSaving(true);
    const toSave = items.filter((i) => dirtyIds.has(i.id));
    for (const it of toSave) {
      const { error } = await supabase
        .from("dealer_price_items" as any)
        .update({
          cod: it.cod, name: it.name, ncm_hs: it.ncm_hs, gtin_ean: it.gtin_ean,
          variant: it.variant, unidade: it.unidade, description: it.description,
          presentation: it.presentation || "Unit",
          quantity_multiplier: Number(it.quantity_multiplier ?? 1),
          price_base: it.price_base, discount_pct: it.discount_pct, price_dealer: it.price_dealer,
        })
        .eq("id", it.id);
      if (error) { toast.error(`Erro em ${it.name}: ${error.message}`); setSaving(false); return; }
    }
    toast.success(`${toSave.length} linhas salvas`);
    setDirtyIds(new Set());
    setSaving(false);
  };

  const saveSnapshot = async () => {
    if (!list || !distributorId) return;
    if (dirtyIds.size > 0) {
      await saveAll();
    }
    const label = snapshotLabel.trim() || `Cotação ${new Date().toLocaleString("pt-BR")}`;
    const { error } = await supabase.from("dealer_price_list_snapshots" as any).insert({
      distributor_id: distributorId,
      price_list_id: list.id,
      label,
      currency: list.currency,
      language: list.language,
      items: items as any,
      totals: totals as any,
    });
    if (error) { toast.error("Erro ao salvar histórico: " + error.message); return; }
    toast.success("Tabela salva no histórico");
    setSnapshotLabel("");
    // reload snapshots
    const { data: snaps } = await supabase
      .from("dealer_price_list_snapshots" as any)
      .select("id,distributor_id,price_list_id,label,currency,language,items,totals,created_at")
      .eq("distributor_id", distributorId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSnapshots(((snaps as any) || []) as DealerSnapshot[]);
  };

  const removeItem = async (id: string) => {
    if (!confirm("Remover este item da tabela?")) return;
    const { error } = await supabase.from("dealer_price_items" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((p) => p.filter((i) => i.id !== id));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, DealerPriceItem[]>();
    items.forEach((i) => {
      const key = `${i.category || "Sem categoria"} / ${i.subcategory || "—"}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return Array.from(map.entries());
  }, [items]);

  const lineTotal = (it: DealerPriceItem) =>
    Number(it.price_dealer || 0) * Number(it.quantity_multiplier ?? 1);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (a, b) => a + Number(b.price_base || 0) * Number(b.quantity_multiplier ?? 1),
      0,
    );
    const total = items.reduce((a, b) => a + lineTotal(b), 0);
    return { subtotal, total, discount: subtotal - total };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[280px]">
          <label className="text-xs text-muted-foreground">Distribuidor</label>
          <Select value={distributorId} onValueChange={setDistributorId}>
            <SelectTrigger><SelectValue placeholder="Selecione um distribuidor…" /></SelectTrigger>
            <SelectContent>
              {distributors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome_fantasia || d.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {list && (
          <>
            <Button variant="outline" onClick={importCatalog} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-1" /> Importar catálogo
            </Button>
            <Button onClick={saveAll} disabled={saving || dirtyIds.size === 0}>
              {saving ? "Salvando…" : dirtyIds.size > 0 ? `Salvar (${dirtyIds.size})` : "Salvo"}
            </Button>
            <div className="flex items-center gap-1">
              <Input
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="Rótulo do snapshot (opcional)"
                className="h-9 w-[220px]"
              />
              <Button variant="secondary" onClick={saveSnapshot} disabled={items.length === 0}>
                <Save className="w-4 h-4 mr-1" /> Salvar no histórico
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowHistory((s) => !s)}>
              <History className="w-4 h-4 mr-1" /> Histórico ({snapshots.length})
            </Button>
            <Button variant="outline" onClick={() => exportPriceTableXlsx(distributor, list, items)}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> XLSX
            </Button>
            <Button variant="outline" onClick={() => exportPriceTablePdf(distributor, list, items)}>
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" onClick={() => exportPriceTableDocx(distributor, list, items)}>
              <FileType className="w-4 h-4 mr-1" /> DOCX
            </Button>
            {onGenerateProposal && (
              <Button variant="secondary" onClick={() => onGenerateProposal(list, items)}>
                Gerar proposta →
              </Button>
            )}
          </>
        )}
      </div>

      {list && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline">v{list.version}</Badge>
            <span className="text-muted-foreground">Moeda:</span>
            <strong>{currency}</strong>
            <span className="text-muted-foreground">Idioma:</span>
            <strong className="uppercase">{list.language || distributor?.language_preference || "pt"}</strong>
            <span className="text-muted-foreground">Itens:</span>
            <strong>{items.length}</strong>
            <span className="text-muted-foreground">Preço tabela total:</span>
            <strong>{formatMoney(totals.subtotal, currency)}</strong>
            <span className="text-muted-foreground">Preço dealer total:</span>
            <strong className="text-primary">{formatMoney(totals.total, currency)}</strong>
            <span className="text-muted-foreground">Desconto:</span>
            <strong className="text-amber-600">
              {totals.subtotal > 0 ? ((totals.discount / totals.subtotal) * 100).toFixed(1) : "0"}%
            </strong>
          </CardContent>
        </Card>
      )}

      {showHistory && list && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" /> Histórico de cotações — {distributor?.nome_fantasia || distributor?.razao_social}
            </h4>
            {snapshots.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma cotação salva ainda. Use “Salvar no histórico” para versionar a tabela atual.</p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Rótulo</TableHead>
                      <TableHead>Moeda</TableHead>
                      <TableHead>Idioma</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Total dealer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((s) => {
                      const arr = Array.isArray(s.items) ? s.items : [];
                      const t = (s.totals && (s.totals as any).total) ?? 0;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-sm">{s.label || "—"}</TableCell>
                          <TableCell>{s.currency}</TableCell>
                          <TableCell className="uppercase">{s.language}</TableCell>
                          <TableCell className="text-right">{arr.length}</TableCell>
                          <TableCell className="text-right font-semibold">{formatMoney(t, s.currency)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !list ? (
        <p className="text-sm text-muted-foreground">Selecione um distribuidor para criar/editar sua tabela.</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Tabela vazia. Clique em <strong>Importar catálogo</strong> para popular todos os produtos ativos.
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, rows]) => (
            <div key={group}>
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">{group}</h4>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Foto</TableHead>
                      <TableHead className="w-24">COD</TableHead>
                      <TableHead className="min-w-[220px]">Produto</TableHead>
                      <TableHead className="w-24">Pres</TableHead>
                      <TableHead className="w-28">NCM/HS</TableHead>
                      <TableHead className="w-32">GTIN/EAN</TableHead>
                      <TableHead className="w-20">Unid (×)</TableHead>
                      <TableHead className="w-28">Preço tabela (Unit)</TableHead>
                      <TableHead className="w-20">% Desc.</TableHead>
                      <TableHead className="w-28">Preço dealer (Unit)</TableHead>
                      <TableHead className="w-28">Preço dealer</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((it) => (
                      <TableRow key={it.id} className={dirtyIds.has(it.id) ? "bg-amber-50/40" : ""}>
                        <TableCell>
                          {it.image_url ? (
                            <img src={it.image_url} alt="" className="w-10 h-10 object-contain bg-muted rounded" />
                          ) : <ImageOff className="w-5 h-5 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <Input value={it.cod ?? ""} onChange={(e) => updateField(it.id, "cod", e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Input value={it.name ?? ""} onChange={(e) => updateField(it.id, "name", e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={(it.presentation as string) || "Unit"}
                            onValueChange={(v) => updateField(it.id, "presentation" as any, v)}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRESENTATION_OPTIONS.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={it.ncm_hs ?? ""} onChange={(e) => updateField(it.id, "ncm_hs", e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Input value={it.gtin_ean ?? ""} onChange={(e) => updateField(it.id, "gtin_ean", e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.quantity_multiplier ?? 1}
                            onChange={(e) => updateField(it.id, "quantity_multiplier" as any, parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" value={it.price_base ?? 0}
                            onChange={(e) => updateField(it.id, "price_base", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.1" value={it.discount_pct ?? 0}
                            onChange={(e) => updateField(it.id, "discount_pct", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" value={it.price_dealer ?? 0}
                            onChange={(e) => updateField(it.id, "price_dealer", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right font-semibold" />
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary text-sm whitespace-nowrap">
                          {formatMoney(lineTotal(it), currency)}
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(it.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
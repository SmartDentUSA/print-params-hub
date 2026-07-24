import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Save, FileSpreadsheet, FileText, FileType, History, Trash2, RotateCcw, Pencil, Plus, ImageOff } from "lucide-react";
import { toast } from "sonner";
import type { DealerPriceItem, DealerPriceList, Distributor } from "./types";
import { recalcDealerPrice, recalcDiscount, formatMoney } from "./types";
import { exportPriceTableXlsx, exportPriceTablePdf, exportPriceTableDocx } from "./DealerProposalExport";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type SavedProposal = {
  id: string;
  proposal_number: string | null;
  currency: string;
  language: string;
  status: string;
  items: any;
  totals: any;
  header_data: any;
  created_at: string;
};

type Props = { distributors: Distributor[] };

export function DealerProposalWizard({ distributors }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [distributorId, setDistributorId] = useState<string>("");
  const [list, setList] = useState<DealerPriceList | null>(null);
  const [items, setItems] = useState<DealerPriceItem[]>([]);
  const [header, setHeader] = useState({
    empresa: "", razao_social: "", contato: "", email: "", pais: "",
  });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pastProposals, setPastProposals] = useState<SavedProposal[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);

  const distributor = distributors.find((d) => d.id === distributorId);

  const loadProposals = async (distId: string) => {
    const { data } = await supabase
      .from("dealer_proposals" as any)
      .select("id,proposal_number,currency,language,status,items,totals,header_data,created_at")
      .eq("distributor_id", distId)
      .order("created_at", { ascending: false })
      .limit(50);
    setPastProposals(((data as any) || []) as SavedProposal[]);
  };

  useEffect(() => {
    if (!distributorId) return;
    loadProposals(distributorId);
    (async () => {
      const { data: lists } = await supabase
        .from("dealer_price_lists" as any).select("*")
        .eq("distributor_id", distributorId).eq("is_active", true)
        .order("version", { ascending: false }).limit(1);
      const l = (lists as any)?.[0];
      setList(l ?? null);
      if (!l) { setItems([]); return; }
      const { data: rows } = await supabase
        .from("dealer_price_items" as any).select("*")
        .eq("price_list_id", l.id)
        .order("category", { ascending: true }).order("sort_order", { ascending: true });
      setItems(((rows as any) || []) as DealerPriceItem[]);
      setPreviewItems([]);
    })();
    const d = distributors.find((x) => x.id === distributorId);
    if (d) setHeader({
      empresa: d.nome_fantasia ?? "",
      razao_social: d.razao_social,
      contato: d.buyer_name ?? d.owner_name ?? "",
      email: d.buyer_email ?? d.owner_email ?? "",
      pais: d.pais ?? "",
    });
  }, [distributorId]);

  const [previewItems, setPreviewItems] = useState<DealerPriceItem[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string | null>>({});
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addOptions, setAddOptions] = useState<Array<{
    key: string;
    product: any;
    variation: any;
    label: string;
  }>>([]);

  useEffect(() => {
    if (step === 2 && !editingId) {
      setPreviewItems(items.map((i) => ({ ...i })));
      setQtyMap(Object.fromEntries(items.map((i) => [i.id, 1])));
    }
  }, [step, items, editingId]);

  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(items.map((i) => i.catalog_product_id).filter(Boolean))) as string[];
      if (ids.length === 0) { setColorMap({}); return; }
      const { data } = await supabase
        .from("catalog_product_variations" as any)
        .select("catalog_product_id,presentation_qty,color")
        .in("catalog_product_id", ids);
      const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
      const map: Record<string, string | null> = {};
      ((data as any) || []).forEach((v: any) => {
        map[`${v.catalog_product_id}::${norm(v.presentation_qty)}`] = v.color ?? null;
      });
      setColorMap(map);
    })();
  }, [items]);

  const getColor = (it: DealerPriceItem) =>
    (it as any).color
    ?? colorMap[`${it.catalog_product_id}::${String(it.presentation_qty ?? "").trim().toLowerCase()}`]
    ?? "";

  const loadProposalForEdit = (p: SavedProposal) => {
    const arr = Array.isArray(p.items) ? (p.items as any[]) : [];
    setEditingId(p.id);
    setEditingCurrency(p.currency);
    setHeader({
      empresa: p.header_data?.empresa ?? "",
      razao_social: p.header_data?.razao_social ?? "",
      contato: p.header_data?.contato ?? "",
      email: p.header_data?.email ?? "",
      pais: p.header_data?.pais ?? "",
    });
    setPreviewItems(arr.map((i) => ({ ...i })) as DealerPriceItem[]);
    setQtyMap(Object.fromEntries(arr.map((i: any) => [i.id, Number(i.quantity ?? i.quantity_multiplier ?? 1) || 1])));
    setSavedId(p.id);
    setStep(2);
  };

  const removePreviewItem = (id: string) => {
    setPreviewItems((prev) => prev.filter((p) => p.id !== id));
  };
  const restoreAllPreviewItems = () => {
    setPreviewItems(items.map((i) => ({ ...i })));
    setQtyMap(Object.fromEntries(items.map((i) => [i.id, 1])));
  };

  const openAddDialog = async () => {
    setAddOpen(true);
    setAddSearch("");
    setAddLoading(true);
    const [prodRes, varRes] = await Promise.all([
      supabase
        .from("system_a_catalog" as any)
        .select("id,external_id,name,name_en,name_es,image_url,product_category,product_subcategory,description,price,price_usd,price_eur,presentation,quantity_multiplier,extra_data,active,approved")
        .eq("approved", true).eq("active", true)
        .in("category", ["product", "resin"])
        .eq("extra_data->>distribute_enabled", "true"),
      supabase.from("catalog_product_variations" as any).select("*"),
    ]);
    setAddLoading(false);
    if (prodRes.error) { toast.error(prodRes.error.message); return; }
    if (varRes.error) { toast.error(varRes.error.message); return; }
    const norm = (v: any) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const existing = new Set(
      previewItems.filter((i) => i.catalog_product_id).map((i) => `${i.catalog_product_id}::${norm(i.presentation_qty)}`),
    );
    const productsById = new Map<string, any>(((prodRes.data as any) || []).map((p: any) => [p.id, p]));
    const opts: Array<{ key: string; product: any; variation: any; label: string }> = [];
    for (const v of (varRes.data as any) || []) {
      const p = productsById.get(v.catalog_product_id);
      if (!p) continue;
      const key = `${v.catalog_product_id}::${norm(v.presentation_qty)}`;
      if (existing.has(key)) continue;
      const variantLabel = [v.presentation_qty, v.presentation, v.color].filter(Boolean).join(" · ");
      opts.push({
        key,
        product: p,
        variation: v,
        label: `${p.name}${variantLabel ? ` — ${variantLabel}` : ""}`,
      });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    setAddOptions(opts);
  };

  const addItemFromOption = (opt: { product: any; variation: any }) => {
    const { product: p, variation: v } = opt;
    const cur = (editingCurrency ?? list?.currency ?? distributor?.preferred_currency ?? "BRL").toUpperCase();
    const priceRaw = cur === "USD" ? v.price_usd : cur === "EUR" ? v.price_eur : (v.price_brl ?? p?.price);
    const priceValue = Number(priceRaw);
    const priceOk = isFinite(priceValue) && priceValue > 0;
    const presRaw = String(v.presentation || "").trim();
    const presentation = (["grs", "Kg", "Item", "ml", "Un"].includes(presRaw) ? presRaw : "Item") as any;
    const tempId = (globalThis.crypto?.randomUUID?.() ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const newItem: DealerPriceItem = {
      id: tempId,
      price_list_id: list?.id ?? "temp",
      catalog_product_id: p.id,
      cod: p.external_id || null,
      sku: v.sku ?? null,
      name: p.name,
      name_en: p.name_en,
      name_es: p.name_es,
      image_url: p.image_url,
      category: p.product_category,
      subcategory: p.product_subcategory,
      description: p.description,
      ncm_hs: v.ncm_hs ?? null,
      gtin_ean: v.gtin_ean ?? null,
      price_base: priceOk ? priceValue : 0,
      presentation,
      quantity_multiplier: Number(p.quantity_multiplier ?? 1) || 1,
      presentation_qty: v.presentation_qty ?? null,
      unidade: v.unidade || "UN",
      is_active: true,
      discount_pct: 0,
      price_dealer: priceOk ? priceValue : 0,
      sort_order: previewItems.length,
      color: v.color ?? null,
    } as any;
    setPreviewItems((prev) => [...prev, newItem]);
    setQtyMap((prev) => ({ ...prev, [tempId]: 1 }));
    setColorMap((prev) => ({
      ...prev,
      [`${p.id}::${String(v.presentation_qty ?? "").trim().toLowerCase()}`]: v.color ?? null,
    }));
    setAddOptions((prev) => prev.filter((o) => o.key !== `${p.id}::${String(v.presentation_qty ?? "").trim().toLowerCase().replace(/\s+/g, "")}`));
    if (!priceOk) toast.warning(`Sem preço em ${cur} — revise antes de exportar`);
    else toast.success("Produto adicionado à proposta");
  };

  const getQty = (id: string) => Math.max(0, Number(qtyMap[id] ?? 1));
  const setQty = (id: string, v: number) => setQtyMap((prev) => ({ ...prev, [id]: Math.max(0, isFinite(v) ? v : 0) }));

  const editPreview = (id: string, field: keyof DealerPriceItem, value: any) => {
    setPreviewItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const next: DealerPriceItem = { ...it, [field]: value } as any;
      if (field === "price_base" || field === "discount_pct") {
        next.price_dealer = recalcDealerPrice(Number(next.price_base), Number(next.discount_pct));
      } else if (field === "price_dealer") {
        next.discount_pct = recalcDiscount(Number(next.price_base), Number(next.price_dealer));
      }
      return next;
    }));
  };

  const totals = useMemo(() => {
    const subtotal = previewItems.reduce((a, b) => a + Number(b.price_base || 0) * getQty(b.id), 0);
    const total = previewItems.reduce((a, b) => a + Number(b.price_dealer || 0) * getQty(b.id), 0);
    return { subtotal, discount_total: subtotal - total, total };
  }, [previewItems, qtyMap]);

  const saveProposal = async () => {
    if (!distributor || previewItems.length === 0) return;
    const itemsWithQty = previewItems.map((it) => ({ ...it, quantity: getQty(it.id), quantity_multiplier: getQty(it.id) }));
    const payload: any = {
      distributor_id: distributor.id,
      price_list_id: list?.id ?? null,
      language: list?.language ?? "pt",
      currency: editingCurrency ?? list?.currency ?? "BRL",
      header_data: header,
      items: itemsWithQty as any,
      totals: totals as any,
      status: "draft",
    };
    if (editingId) {
      const { error } = await supabase.from("dealer_proposals" as any).update(payload).eq("id", editingId);
      if (error) return toast.error("Erro ao atualizar: " + error.message);
      toast.success("Proposta atualizada");
    } else {
      payload.proposal_number = `PRO-${Date.now()}`;
      const { data, error } = await supabase.from("dealer_proposals" as any).insert(payload).select("id").single();
      if (error) return toast.error("Erro ao salvar: " + error.message);
      setSavedId((data as any).id);
      toast.success("Proposta salva");
    }
    loadProposals(distributor.id);
  };

  const stubList: DealerPriceList = {
    id: list?.id ?? "temp",
    distributor_id: distributor?.id ?? list?.distributor_id ?? "",
    name: list?.name ?? "Proposta",
    currency: editingCurrency ?? list?.currency ?? "BRL",
    language: list?.language ?? "pt",
    exchange_rate: list?.exchange_rate ?? null,
    version: list?.version ?? 1,
    is_active: list?.is_active ?? true,
    notes: list?.notes ?? null,
    created_at: list?.created_at ?? "",
    updated_at: list?.updated_at ?? "",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === 1 ? "default" : "outline"}>1. Distribuidor</Badge>
        <ArrowRight className="w-3 h-3" />
        <Badge variant={step === 2 ? "default" : "outline"}>2. Preview & Export</Badge>
      </div>

      {step === 1 && (
        <Card><CardHeader><CardTitle className="text-base">Selecionar distribuidor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={distributorId} onValueChange={setDistributorId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Escolha o distribuidor…" /></SelectTrigger>
              <SelectContent>
                {distributors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome_fantasia || d.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {distributorId && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                <div><label className="text-xs">Empresa</label><Input value={header.empresa} onChange={(e) => setHeader({ ...header, empresa: e.target.value })} /></div>
                <div><label className="text-xs">Razão social</label><Input value={header.razao_social} onChange={(e) => setHeader({ ...header, razao_social: e.target.value })} /></div>
                <div><label className="text-xs">Contato (comprador)</label><Input value={header.contato} onChange={(e) => setHeader({ ...header, contato: e.target.value })} /></div>
                <div><label className="text-xs">E-mail</label><Input value={header.email} onChange={(e) => setHeader({ ...header, email: e.target.value })} /></div>
                <div><label className="text-xs">País</label><Input value={header.pais} onChange={(e) => setHeader({ ...header, pais: e.target.value })} /></div>
                <div className="text-xs text-muted-foreground self-end">
                  {list ? `Tabela vigente: v${list.version} (${items.length} itens)` : "Sem tabela vigente — crie uma na aba Tabela de Preço."}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={() => setStep(2)} disabled={!distributorId || !list || items.length === 0}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {distributorId && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <History className="w-4 h-4" /> Histórico de propostas ({pastProposals.length})
                </h4>
                {pastProposals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma proposta gerada ainda para este distribuidor.</p>
                ) : (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Nº</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Moeda</TableHead>
                          <TableHead className="text-right">Itens</TableHead>
                          <TableHead className="text-right">Total dealer</TableHead>
                          <TableHead className="text-right">Exportar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pastProposals.map((p) => {
                          const arr = Array.isArray(p.items) ? (p.items as DealerPriceItem[]) : [];
                          const total = (p.totals && (p.totals as any).total) ?? 0;
                          const propList: DealerPriceList = {
                            id: "prop", distributor_id: distributor?.id ?? "", name: p.proposal_number ?? "Proposta",
                            currency: p.currency, language: p.language, exchange_rate: null,
                            version: 1, is_active: true, notes: null,
                            created_at: p.created_at, updated_at: p.created_at,
                          };
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                              <TableCell className="text-xs">{p.proposal_number || p.id.slice(0, 8)}</TableCell>
                              <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                              <TableCell>{p.currency}</TableCell>
                              <TableCell className="text-right">{arr.length}</TableCell>
                              <TableCell className="text-right font-semibold">{formatMoney(total, p.currency)}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <Button size="icon" variant="ghost" title="Editar"
                                  onClick={() => loadProposalForEdit(p)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" title="XLSX"
                                  onClick={() => exportPriceTableXlsx(distributor, propList, arr, "proposta")}>
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" title="PDF"
                                  onClick={() => exportPriceTablePdf(distributor, propList, arr, { title: "Proposal / Price Table", filenamePrefix: "proposta" })}>
                                  <FileText className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" title="DOCX"
                                  onClick={() => exportPriceTableDocx(distributor, propList, arr, "proposta")}>
                                  <FileType className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div>
                  <h3 className="text-lg font-bold">SMART DENT — Price Table</h3>
                  <p className="text-xs text-muted-foreground">Smart Dent BR · Smart Dent USA · FDA · ISO 13485:2016 · ANSM · TrinovaBiochem</p>
                </div>
                <div className="text-right text-xs">
                  <p><strong>Data:</strong> {new Date().toLocaleDateString("pt-BR")}</p>
                  <p><strong>Moeda:</strong> {list?.currency ?? "BRL"}</p>
                  <p><strong>Versão:</strong> v{list?.version ?? 1}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Empresa:</span> <Input className="inline-block w-auto min-w-[240px] h-7 ml-1" value={header.empresa} onChange={(e) => setHeader({ ...header, empresa: e.target.value })} /></div>
                <div><span className="text-muted-foreground">Razão social:</span> <Input className="inline-block w-auto min-w-[240px] h-7 ml-1" value={header.razao_social} onChange={(e) => setHeader({ ...header, razao_social: e.target.value })} /></div>
                <div><span className="text-muted-foreground">Contato:</span> <Input className="inline-block w-auto min-w-[240px] h-7 ml-1" value={header.contato} onChange={(e) => setHeader({ ...header, contato: e.target.value })} /></div>
                <div><span className="text-muted-foreground">E-mail:</span> <Input className="inline-block w-auto min-w-[240px] h-7 ml-1" value={header.email} onChange={(e) => setHeader({ ...header, email: e.target.value })} /></div>
                <div><span className="text-muted-foreground">País:</span> <Input className="inline-block w-auto min-w-[240px] h-7 ml-1" value={header.pais} onChange={(e) => setHeader({ ...header, pais: e.target.value })} /></div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{previewItems.length} itens na proposta</Badge>
                <Button size="sm" variant="outline" onClick={openAddDialog}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar produto
                </Button>
                <Button size="sm" variant="ghost" onClick={restoreAllPreviewItems}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar todos
                </Button>
              </div>

              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2 text-left">Foto</th>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-left">NCM</th>
                      <th className="p-2 text-left">GTIN</th>
                      <th className="p-2 text-left">Variante</th>
                      <th className="p-2 text-left">Pres</th>
                      <th className="p-2 text-left">Cor</th>
                      <th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-right">Preço unitário</th>
                      <th className="p-2 text-right">Desc %</th>
                      <th className="p-2 text-right">Desc ({editingCurrency ?? list?.currency ?? "BRL"})</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((it) => (
                      <tr key={it.id} className="border-b">
                        <td className="p-1 text-center">
                          <Button size="icon" variant="ghost" title="Remover" onClick={() => removePreviewItem(it.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </td>
                        <td className="p-1">{it.image_url ? <img src={it.image_url} alt="" className="w-10 h-10 object-contain bg-muted rounded" /> : "—"}</td>
                        <td className="p-1 min-w-[220px] whitespace-normal">{it.name}</td>
                        <td className="p-1 whitespace-nowrap">{it.sku ?? it.cod ?? "—"}</td>
                        <td className="p-1 whitespace-nowrap">{it.ncm_hs ?? "—"}</td>
                        <td className="p-1 whitespace-nowrap">{it.gtin_ean ?? "—"}</td>
                        <td className="p-1 whitespace-nowrap">{it.variant ?? it.presentation_qty ?? "—"}</td>
                        <td className="p-1 whitespace-nowrap">{it.presentation ?? "—"}</td>
                        <td className="p-1 whitespace-nowrap">{getColor(it) || "—"}</td>
                        <td className="p-1 w-20">
                          <Input className="h-7 text-right" type="number" min="0" step="1" value={getQty(it.id)} onChange={(e) => setQty(it.id, parseInt(e.target.value) || 0)} />
                        </td>
                        <td className="p-1"><Input className="h-7 text-right" type="number" step="0.01" value={it.price_base} onChange={(e) => editPreview(it.id, "price_base", parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input className="h-7 text-right" type="number" step="0.1" value={it.discount_pct} onChange={(e) => editPreview(it.id, "discount_pct", parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1 text-right whitespace-nowrap text-muted-foreground">
                          {formatMoney(((Number(it.price_base) || 0) - (Number(it.price_dealer) || 0)) * getQty(it.id), editingCurrency ?? list?.currency)}
                        </td>
                        <td className="p-1 text-right whitespace-nowrap font-semibold text-primary">
                          {formatMoney((Number(it.price_dealer) || 0) * getQty(it.id), editingCurrency ?? list?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-semibold">
                    <tr>
                      <td colSpan={10} className="p-2 text-right">Totais:</td>
                      <td className="p-2 text-right">{formatMoney(totals.subtotal, editingCurrency ?? list?.currency)}</td>
                      <td className="p-2 text-right">{totals.subtotal > 0 ? ((totals.discount_total / totals.subtotal) * 100).toFixed(1) : 0}%</td>
                      <td className="p-2 text-right">{formatMoney(totals.discount_total, editingCurrency ?? list?.currency)}</td>
                      <td className="p-2 text-right text-primary">{formatMoney(totals.total, editingCurrency ?? list?.currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-center text-xs text-muted-foreground pt-2">WWW.SMARTDENT.COM.BR</p>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => { setStep(1); setEditingId(null); setEditingCurrency(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveProposal} disabled={previewItems.length === 0}><Save className="w-4 h-4 mr-1" /> {editingId ? "Atualizar proposta" : "Salvar proposta"}</Button>
              <Button variant="outline" onClick={() => exportPriceTableXlsx(distributor, stubList, previewItems.map((it) => ({ ...it, color: getColor(it), quantity: getQty(it.id), quantity_multiplier: getQty(it.id) })) as any, "proposta")}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> XLSX
              </Button>
              <Button variant="outline" onClick={() => exportPriceTablePdf(distributor, stubList, previewItems.map((it) => ({ ...it, color: getColor(it), quantity: getQty(it.id), quantity_multiplier: getQty(it.id) })) as any, { title: "Proposal / Price Table", filenamePrefix: "proposta" })}>
                <FileText className="w-4 h-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" onClick={() => exportPriceTableDocx(distributor, stubList, previewItems.map((it) => ({ ...it, color: getColor(it), quantity: getQty(it.id), quantity_multiplier: getQty(it.id) })) as any, "proposta")}>
                <FileType className="w-4 h-4 mr-1" /> DOCX
              </Button>
            </div>
          </div>
          {savedId && <p className="text-xs text-muted-foreground">Proposta salva: {savedId}</p>}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar produto Smart Dent</DialogTitle>
            <DialogDescription>
              Selecione uma variação liberada para distribuição para incluir na proposta ({editingCurrency ?? list?.currency ?? "BRL"}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder="Buscar por produto, SKU, apresentação, cor…"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
            />
            <div className="max-h-[420px] overflow-y-auto border rounded">
              {addLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
              ) : addOptions.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhuma variação disponível. Ative "Distribuição" em Gestão de Catálogo.
                </div>
              ) : (
                (() => {
                  const q = addSearch.trim().toLowerCase();
                  const filtered = q
                    ? addOptions.filter((o) => {
                        const hay = `${o.label} ${o.variation.sku ?? ""} ${o.product.external_id ?? ""}`.toLowerCase();
                        return hay.includes(q);
                      })
                    : addOptions;
                  return filtered.slice(0, 200).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => addItemFromOption(o)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left border-b last:border-b-0"
                    >
                      {o.product.image_url
                        ? <img src={o.product.image_url} alt="" className="w-10 h-10 object-contain bg-muted rounded" />
                        : <div className="w-10 h-10 bg-muted rounded flex items-center justify-center"><ImageOff className="w-4 h-4 text-muted-foreground" /></div>}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{o.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[o.product.product_category, o.variation.sku, o.product.external_id].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-primary" />
                    </button>
                  ));
                })()
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
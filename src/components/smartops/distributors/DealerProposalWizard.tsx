import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Save, FileSpreadsheet, FileText, FileType, ImageOff, History, Download } from "lucide-react";
import { toast } from "sonner";
import type { DealerPriceItem, DealerPriceList, Distributor } from "./types";
import { recalcDealerPrice, recalcDiscount, formatMoney } from "./types";
import { exportPriceTableXlsx, exportPriceTablePdf, exportPriceTableDocx } from "./DealerProposalExport";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [distributorId, setDistributorId] = useState<string>("");
  const [list, setList] = useState<DealerPriceList | null>(null);
  const [items, setItems] = useState<DealerPriceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [header, setHeader] = useState({
    empresa: "", razao_social: "", contato: "", email: "", pais: "",
  });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pastProposals, setPastProposals] = useState<SavedProposal[]>([]);

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
      setSelectedIds(new Set());
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

  const groups = useMemo(() => {
    const m = new Map<string, DealerPriceItem[]>();
    items.forEach((i) => {
      const key = i.category || "Sem categoria";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(i);
    });
    return Array.from(m.entries());
  }, [items]);

  const toggleCategory = (cat: string, on: boolean) => {
    const next = new Set(selectedIds);
    const catItems = items.filter((i) => (i.category || "Sem categoria") === cat);
    catItems.forEach((i) => { if (on) next.add(i.id); else next.delete(i.id); });
    setSelectedIds(next);
    const nc = new Set(selectedCats); if (on) nc.add(cat); else nc.delete(cat);
    setSelectedCats(nc);
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const proposalItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );
  const [previewItems, setPreviewItems] = useState<DealerPriceItem[]>([]);

  useEffect(() => {
    if (step === 3) setPreviewItems(proposalItems.map((i) => ({ ...i })));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const subtotal = previewItems.reduce((a, b) => a + Number(b.price_base || 0), 0);
    const total = previewItems.reduce((a, b) => a + Number(b.price_dealer || 0), 0);
    return { subtotal, discount_total: subtotal - total, total };
  }, [previewItems]);

  const saveProposal = async () => {
    if (!distributor || previewItems.length === 0) return;
    const payload = {
      distributor_id: distributor.id,
      price_list_id: list?.id ?? null,
      language: list?.language ?? "pt",
      currency: list?.currency ?? "BRL",
      header_data: header,
      items: previewItems as any,
      totals: totals as any,
      status: "draft",
      proposal_number: `PRO-${Date.now()}`,
    };
    const { data, error } = await supabase.from("dealer_proposals" as any).insert(payload).select("id").single();
    if (error) return toast.error("Erro ao salvar: " + error.message);
    setSavedId((data as any).id);
    toast.success("Proposta salva");
    loadProposals(distributor.id);
  };

  const stubList: DealerPriceList = list ?? {
    id: "temp", distributor_id: distributor?.id ?? "", name: "Proposta", currency: "BRL",
    language: "pt", exchange_rate: null, version: 1, is_active: true, notes: null,
    created_at: "", updated_at: "",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === 1 ? "default" : "outline"}>1. Distribuidor</Badge>
        <ArrowRight className="w-3 h-3" />
        <Badge variant={step === 2 ? "default" : "outline"}>2. Produtos</Badge>
        <ArrowRight className="w-3 h-3" />
        <Badge variant={step === 3 ? "default" : "outline"}>3. Preview & Export</Badge>
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
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card><CardHeader><CardTitle className="text-base">Selecionar categorias e produtos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{selectedIds.size} produtos selecionados</Badge>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set(items.map((i) => i.id)))}>Selecionar todos</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
            </div>
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
              {groups.map(([cat, rows]) => {
                const allSel = rows.every((r) => selectedIds.has(r.id));
                return (
                  <div key={cat} className="border rounded-md p-2">
                    <label className="flex items-center gap-2 font-semibold text-sm mb-2">
                      <Checkbox checked={allSel} onCheckedChange={(v) => toggleCategory(cat, !!v)} />
                      {cat} <span className="text-xs text-muted-foreground">({rows.length})</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {rows.map((it) => (
                        <label key={it.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer">
                          <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleItem(it.id)} />
                          {it.image_url
                            ? <img src={it.image_url} className="w-8 h-8 object-contain bg-muted rounded" alt="" />
                            : <ImageOff className="w-4 h-4 text-muted-foreground" />}
                          <span className="flex-1 truncate">{it.name}</span>
                          <span className="text-xs text-muted-foreground">{formatMoney(it.price_dealer, list?.currency)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={selectedIds.size === 0}>Gerar preview <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
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

              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="p-2 text-left">Foto</th>
                      <th className="p-2 text-left">COD</th>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-left">Variante</th>
                      <th className="p-2 text-left">GTIN/EAN</th>
                      <th className="p-2 text-left">NCM/HS</th>
                      <th className="p-2 text-right">Preço</th>
                      <th className="p-2 text-right">Desc.</th>
                      <th className="p-2 text-right">Preço dealer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((it) => (
                      <tr key={it.id} className="border-b">
                        <td className="p-1">{it.image_url ? <img src={it.image_url} alt="" className="w-10 h-10 object-contain bg-muted rounded" /> : "—"}</td>
                        <td className="p-1"><Input className="h-7" value={it.cod ?? ""} onChange={(e) => editPreview(it.id, "cod", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7" value={it.name} onChange={(e) => editPreview(it.id, "name", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7" value={it.variant ?? ""} onChange={(e) => editPreview(it.id, "variant", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7" value={it.gtin_ean ?? ""} onChange={(e) => editPreview(it.id, "gtin_ean", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7" value={it.ncm_hs ?? ""} onChange={(e) => editPreview(it.id, "ncm_hs", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7 text-right" type="number" step="0.01" value={it.price_base} onChange={(e) => editPreview(it.id, "price_base", parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input className="h-7 text-right" type="number" step="0.1" value={it.discount_pct} onChange={(e) => editPreview(it.id, "discount_pct", parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input className="h-7 text-right font-semibold" type="number" step="0.01" value={it.price_dealer} onChange={(e) => editPreview(it.id, "price_dealer", parseFloat(e.target.value) || 0)} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-semibold">
                    <tr>
                      <td colSpan={6} className="p-2 text-right">Totais:</td>
                      <td className="p-2 text-right">{formatMoney(totals.subtotal, list?.currency)}</td>
                      <td className="p-2 text-right">{totals.subtotal > 0 ? ((totals.discount_total / totals.subtotal) * 100).toFixed(1) : 0}%</td>
                      <td className="p-2 text-right text-primary">{formatMoney(totals.total, list?.currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-center text-xs text-muted-foreground pt-2">WWW.SMARTDENT.COM.BR</p>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveProposal}><Save className="w-4 h-4 mr-1" /> Salvar proposta</Button>
              <Button variant="outline" onClick={() => exportPriceTableXlsx(distributor, stubList, previewItems, "proposta")}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> XLSX
              </Button>
              <Button variant="outline" onClick={() => exportPriceTablePdf(distributor, stubList, previewItems, { title: "Proposal / Price Table", filenamePrefix: "proposta" })}>
                <FileText className="w-4 h-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" onClick={() => exportPriceTableDocx(distributor, stubList, previewItems, "proposta")}>
                <FileType className="w-4 h-4 mr-1" /> DOCX
              </Button>
            </div>
          </div>
          {savedId && <p className="text-xs text-muted-foreground">Proposta salva: {savedId}</p>}
        </div>
      )}
    </div>
  );
}
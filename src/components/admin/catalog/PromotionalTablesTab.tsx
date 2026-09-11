import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, FileText, ImagePlus, Loader2, PackagePlus, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { exportPromotionalPdf } from "./exportPromotionalPdf";
import type { PromotionalItem, PromotionalSectionWithItems, PromotionalStatus, PromotionalTable } from "./promotionalTypes";
import { itemTotals } from "./promotionalTypes";

type DistributorOption = { id: string; razao_social: string; nome_fantasia: string | null };
type CatalogOption = {
  key: string; productId: string; variationId: string | null; name: string; sku: string | null;
  imageUrl: string | null; price: number; variation: string | null;
};

const blankTable = (): Omit<PromotionalTable, "id" | "created_at" | "updated_at"> => ({
  name: "", pdf_title: "TABELA PROMOCIONAL", distributor_id: null, currency: "BRL",
  valid_from: null, valid_until: null, notes: null, status: "draft",
  include_official_price_table: true,
});

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value || 0);

export function PromotionalTablesTab() {
  const [tables, setTables] = useState<PromotionalTable[]>([]);
  const [selected, setSelected] = useState<PromotionalTable | null>(null);
  const [draft, setDraft] = useState(blankTable());
  const [sections, setSections] = useState<PromotionalSectionWithItems[]>([]);
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerSection, setPickerSection] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customSection, setCustomSection] = useState<string | null>(null);
  const [customItem, setCustomItem] = useState({ name: "", description: "", quantity: "1", market: "0", promotional: "0" });

  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);

  const loadTables = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: rows, error } = await supabase
        .from("promotional_tables" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
        toast.error(`Erro ao carregar promoções: ${error.message}`);
      }
      setTables(((rows as any) || []) as PromotionalTable[]);

      const { data: dist, error: distError } = await supabase
        .from("distributors" as any)
        .select("id,razao_social,nome_fantasia")
        .eq("active", true)
        .order("razao_social");
      if (distError) console.warn("distributors", distError.message);
      setDistributors(((dist as any) || []) as DistributorOption[]);
    } catch (err: any) {
      setLoadError(err?.message || "Falha inesperada ao carregar as tabelas promocionais.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => { loadTables(); }, []);

  const loadSections = async (table: PromotionalTable) => {
    const { data: sectionRows, error } = await supabase
      .from("promotional_table_sections" as any).select("*")
      .eq("promotional_table_id", table.id).order("sort_order");
    if (error) { toast.error(error.message); return; }
    const ids = ((sectionRows as any) || []).map((row: any) => row.id);
    const itemRows = ids.length
      ? await supabase.from("promotional_table_items" as any).select("*").in("section_id", ids).order("sort_order")
      : { data: [], error: null };
    if (itemRows.error) { toast.error(itemRows.error.message); return; }
    const items = ((itemRows.data as any) || []) as PromotionalItem[];
    setSections((((sectionRows as any) || []) as any[]).map((section) => ({
      ...section, items: items.filter((item) => item.section_id === section.id),
    })));
  };

  const openTable = async (table: PromotionalTable) => {
    setSelected(table);
    setDraft({
      name: table.name, pdf_title: table.pdf_title, distributor_id: table.distributor_id,
      currency: table.currency, valid_from: table.valid_from, valid_until: table.valid_until,
      notes: table.notes, status: table.status,
      include_official_price_table: table.include_official_price_table !== false,
    });
    await loadSections(table);
  };

  const saveTable = async () => {
    if (!draft.name.trim()) { toast.error("Informe o nome da tabela promocional."); return; }
    setSaving(true);
    if (selected?.id) {
      const { data, error } = await supabase.from("promotional_tables" as any).update(draft).eq("id", selected.id).select("*").single();
      if (error) toast.error(error.message);
      else { setSelected(data as any); toast.success("Tabela promocional salva."); await loadTables(); }
    } else {
      const { data, error } = await supabase.from("promotional_tables" as any).insert(draft).select("*").single();
      if (error) toast.error(error.message);
      else { toast.success("Tabela promocional criada."); await loadTables(); await openTable(data as any); }
    }
    setSaving(false);
  };

  const addSection = async () => {
    if (!selected) { toast.info("Salve a tabela antes de adicionar combos."); return; }
    const { error } = await supabase.from("promotional_table_sections" as any).insert({
      promotional_table_id: selected.id, title: `Combo ${sections.length + 1}`, sort_order: sections.length,
    });
    if (error) toast.error(error.message); else await loadSections(selected);
  };

  const uploadSectionImage = async (sectionId: string, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem."); return; }
    setUploadingSection(sectionId);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `promocionais/${sectionId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("catalog-images").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("catalog-images").getPublicUrl(path);
      await updateSection(sectionId, { image_url: data.publicUrl });
      toast.success("Foto do combo atualizada.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível enviar a foto.");
    } finally {
      setUploadingSection(null);
    }
  };

  const updateSection = async (id: string, patch: Record<string, unknown>) => {
    setSections((current) => current.map((section) => section.id === id ? { ...section, ...patch } : section));
    const { error } = await supabase.from("promotional_table_sections" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length || !selected) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    await Promise.all(next.map((section, order) => supabase.from("promotional_table_sections" as any).update({ sort_order: order }).eq("id", section.id)));
  };

  const removeSection = async (sectionId: string) => {
    if (!confirm("Excluir esta seção e todos os seus itens?")) return;
    const { error } = await supabase.from("promotional_table_sections" as any).delete().eq("id", sectionId);
    if (error) toast.error(error.message); else setSections((current) => current.filter((section) => section.id !== sectionId));
  };

  const loadCatalog = async () => {
    const [{ data: products, error }, { data: variations }] = await Promise.all([
      supabase.from("system_a_catalog" as any)
        .select("id,name,image_url,price,category,active,approved")
        .in("category", [...PRODUCT_CATALOG_ENTITY_TYPES]).eq("active", true).eq("approved", true).order("name"),
      supabase.from("catalog_product_variations" as any).select("id,catalog_product_id,presentation_qty,sku,price_brl,price_usd,price_eur,sort_order").order("sort_order"),
    ]);
    if (error) { toast.error(error.message); return; }
    const byProduct = new Map<string, any[]>();
    for (const variation of ((variations as any) || [])) {
      const list = byProduct.get(variation.catalog_product_id) || [];
      list.push(variation);
      byProduct.set(variation.catalog_product_id, list);
    }
    const rows: CatalogOption[] = [];
    for (const product of ((products as any) || [])) {
      const vars = byProduct.get(product.id) || [];
      if (!vars.length) rows.push({ key: product.id, productId: product.id, variationId: null, name: product.name, sku: null, imageUrl: product.image_url, price: Number(product.price || 0), variation: null });
      for (const variation of vars) {
        const priceKey = draft.currency === "USD" ? "price_usd" : draft.currency === "EUR" ? "price_eur" : "price_brl";
        rows.push({ key: variation.id, productId: product.id, variationId: variation.id, name: product.name, sku: variation.sku, imageUrl: product.image_url, price: Number(variation[priceKey] ?? product.price ?? 0), variation: variation.presentation_qty });
      }
    }
    setCatalog(rows);
  };

  const openPicker = async (sectionId: string) => { setPickerSection(sectionId); setCatalogSearch(""); await loadCatalog(); };

  const addCatalogItem = async (option: CatalogOption) => {
    if (!pickerSection || !selected) return;
    const section = sections.find((row) => row.id === pickerSection);
    const { error } = await supabase.from("promotional_table_items" as any).insert({
      section_id: pickerSection, catalog_product_id: option.productId, catalog_variation_id: option.variationId,
      item_type: "catalog", name: option.variation ? `${option.name} — ${option.variation}` : option.name,
      sku: option.sku, image_url: option.imageUrl, quantity: 1, market_unit_price: option.price,
      promotional_unit_price: option.price, sort_order: section?.items.length || 0,
    });
    if (error) toast.error(error.message); else { toast.success("Produto adicionado."); setPickerSection(null); await loadSections(selected); }
  };

  const addCustomItem = async () => {
    if (!customSection || !selected || !customItem.name.trim()) return;
    const section = sections.find((row) => row.id === customSection);
    const { error } = await supabase.from("promotional_table_items" as any).insert({
      section_id: customSection, item_type: "custom", name: customItem.name.trim(), description: customItem.description.trim() || null,
      quantity: Number(customItem.quantity) || 1, market_unit_price: Number(customItem.market) || 0,
      promotional_unit_price: Number(customItem.promotional) || 0, sort_order: section?.items.length || 0,
    });
    if (error) toast.error(error.message); else {
      setCustomOpen(false); setCustomItem({ name: "", description: "", quantity: "1", market: "0", promotional: "0" });
      await loadSections(selected);
    }
  };

  const updateItem = async (id: string, patch: Record<string, unknown>) => {
    setSections((current) => current.map((section) => ({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...patch } as PromotionalItem : item) })));
    const { error } = await supabase.from("promotional_table_items" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("promotional_table_items" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else setSections((current) => current.map((section) => ({ ...section, items: section.items.filter((item) => item.id !== id) })));
  };

  const duplicateTable = async (table: PromotionalTable) => {
    const { data: sourceSections } = await supabase.from("promotional_table_sections" as any).select("*").eq("promotional_table_id", table.id).order("sort_order");
    const sourceIds = ((sourceSections as any) || []).map((section: any) => section.id);
    const { data: sourceItems } = sourceIds.length ? await supabase.from("promotional_table_items" as any).select("*").in("section_id", sourceIds) : { data: [] } as any;
    const { data: copy, error } = await supabase.from("promotional_tables" as any).insert({ ...table, id: undefined, name: `${table.name} — cópia`, status: "draft", created_at: undefined, updated_at: undefined, created_by: undefined }).select("*").single();
    if (error || !copy) { toast.error(error?.message || "Não foi possível duplicar."); return; }
    for (const sourceSection of ((sourceSections as any) || [])) {
      const { data: newSection } = await supabase.from("promotional_table_sections" as any).insert({ promotional_table_id: (copy as any).id, title: sourceSection.title, description: sourceSection.description, image_url: sourceSection.image_url, sort_order: sourceSection.sort_order }).select("*").single();
      if (!newSection) continue;
      const rows = ((sourceItems as any) || []).filter((item: any) => item.section_id === sourceSection.id).map(({ id, section_id, created_at, updated_at, ...item }: any) => ({ ...item, section_id: (newSection as any).id }));
      if (rows.length) await supabase.from("promotional_table_items" as any).insert(rows);
    }
    toast.success("Tabela duplicada."); await loadTables();
  };

  const getTableSections = async (tableId: string): Promise<PromotionalSectionWithItems[]> => {
    const { data: sectionRows, error } = await supabase.from("promotional_table_sections" as any).select("*").eq("promotional_table_id", tableId).order("sort_order");
    if (error) { toast.error(error.message); return []; }
    const ids = ((sectionRows as any) || []).map((section: any) => section.id);
    const { data: itemRows, error: itemError } = ids.length
      ? await supabase.from("promotional_table_items" as any).select("*").in("section_id", ids).order("sort_order")
      : { data: [], error: null };
    if (itemError) { toast.error(itemError.message); return []; }
    return (((sectionRows as any) || []) as any[]).map((section) => ({
      ...section,
      items: (((itemRows as any) || []) as PromotionalItem[]).filter((item) => item.section_id === section.id),
    }));
  };

  const runExport = async (
    table: PromotionalTable,
    rows: PromotionalSectionWithItems[],
    mode: "download" | "preview" = "download",
  ) => {
    if (!rows.some((section) => section.items.length)) { toast.info("Adicione itens antes de gerar o PDF."); return; }
    try {
      await exportPromotionalPdf(table, rows, distributorName(table.distributor_id), mode);
    } catch (error: any) {
      console.error("[promotional-pdf]", error);
      toast.error(error?.message || "Não foi possível gerar o PDF.");
    }
  };

  const exportFromList = async (table: PromotionalTable) => {
    const rows = await getTableSections(table.id);
    await runExport(table, rows);
  };

  const removeTable = async (table: PromotionalTable) => {
    if (!confirm(`Excluir a tabela promocional “${table.name}”?`)) return;
    const { error } = await supabase.from("promotional_tables" as any).delete().eq("id", table.id);
    if (error) toast.error(error.message); else { toast.success("Tabela excluída."); await loadTables(); }
  };

  const totals = useMemo(() => sections.flatMap((section) => section.items).reduce((sum, item) => {
    const row = itemTotals(item); return { market: sum.market + row.market, promotional: sum.promotional + row.promotional };
  }, { market: 0, promotional: 0 }), [sections]);
  const filteredCatalog = catalog.filter((option) => `${option.name} ${option.sku || ""} ${option.variation || ""}`.toLowerCase().includes(catalogSearch.toLowerCase()));
  const distributorName = (id: string | null) => {
    const distributor = distributors.find((row) => row.id === id);
    return distributor?.nome_fantasia || distributor?.razao_social || undefined;
  };

  if (!selected) return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-semibold">Tabelas promocionais</h3><p className="text-sm text-muted-foreground">Monte combos gerais ou por distribuidor e gere PDFs para ações comerciais.</p></div>
        <Button onClick={() => { setDraft(blankTable()); setSections([]); setSelected({ id: "", created_at: "", updated_at: "", ...blankTable() } as PromotionalTable); }}><Plus className="mr-2 h-4 w-4" />Nova tabela</Button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : loadError ? <Card><CardContent className="space-y-3 p-10 text-center"><p className="text-sm text-destructive">Não foi possível carregar: {loadError}</p><Button variant="outline" size="sm" onClick={loadTables}>Tentar novamente</Button></CardContent></Card> : tables.length === 0 ? <Card><CardContent className="p-10 text-center text-muted-foreground">Nenhuma tabela promocional criada.</CardContent></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tables.map((table) => (
          <Card key={table.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{table.name}</CardTitle><Badge variant={table.status === "active" ? "default" : "secondary"}>{table.status === "active" ? "Ativa" : table.status === "archived" ? "Arquivada" : "Rascunho"}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="text-sm text-muted-foreground">{distributorName(table.distributor_id) || "Campanha geral"}<br />{table.valid_until ? `Válida até ${new Date(`${table.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}` : "Sem validade definida"}</div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => openTable(table)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" onClick={() => exportFromList(table)}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button><Button size="sm" variant="outline" onClick={() => duplicateTable(table)}><Copy className="mr-1 h-3.5 w-3.5" />Duplicar</Button><Button size="icon" variant="ghost" title="Excluir tabela" onClick={() => removeTable(table)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardContent></Card>
        ))}</div>
      )}
    </div>
  );

  const persisted = Boolean(selected.id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={() => { setSelected(null); setSections([]); }}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!persisted || !sections.some((section) => section.items.length)} onClick={() => runExport({ ...selected, ...draft } as PromotionalTable, sections, "preview")}><Eye className="mr-2 h-4 w-4" />Visualizar PDF</Button><Button variant="outline" disabled={!persisted || !sections.some((section) => section.items.length)} onClick={() => runExport({ ...selected, ...draft } as PromotionalTable, sections)}><FileText className="mr-2 h-4 w-4" />Exportar PDF</Button><Button onClick={saveTable} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar tabela"}</Button></div></div>
      <Card><CardHeader><CardTitle>Dados da promoção</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2 md:col-span-2"><Label>Nome interno</Label><Input value={draft.name} onChange={(e) => setDraft((value) => ({ ...value, name: e.target.value }))} placeholder="Ex.: Combo Congresso CIPRO" /></div>
        <div className="space-y-2 md:col-span-2"><Label>Título no PDF</Label><Input value={draft.pdf_title} onChange={(e) => setDraft((value) => ({ ...value, pdf_title: e.target.value }))} /></div>
        <div className="space-y-2"><Label>Uso</Label><Select value={draft.distributor_id || "general"} onValueChange={(value) => setDraft((row) => ({ ...row, distributor_id: value === "general" ? null : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">Campanha geral</SelectItem>{distributors.map((distributor) => <SelectItem key={distributor.id} value={distributor.id}>{distributor.nome_fantasia || distributor.razao_social}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Moeda</Label><Select value={draft.currency} onValueChange={(currency) => setDraft((row) => ({ ...row, currency }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BRL">BRL — Real</SelectItem><SelectItem value="USD">USD — Dólar</SelectItem><SelectItem value="EUR">EUR — Euro</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Início</Label><Input type="date" value={draft.valid_from || ""} onChange={(e) => setDraft((row) => ({ ...row, valid_from: e.target.value || null }))} /></div>
        <div className="space-y-2"><Label>Fim</Label><Input type="date" value={draft.valid_until || ""} onChange={(e) => setDraft((row) => ({ ...row, valid_until: e.target.value || null }))} /></div>
        <div className="space-y-2"><Label>Status</Label><Select value={draft.status} onValueChange={(status: PromotionalStatus) => setDraft((row) => ({ ...row, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Rascunho</SelectItem><SelectItem value="active">Ativa</SelectItem><SelectItem value="archived">Arquivada</SelectItem></SelectContent></Select></div>
        <div className="space-y-2 xl:col-span-3"><Label>Observações e condições</Label><Textarea value={draft.notes || ""} onChange={(e) => setDraft((row) => ({ ...row, notes: e.target.value || null }))} placeholder="Condições de pagamento, disponibilidade ou observações do combo" /></div>
        <div className="flex items-start gap-3 rounded-md border p-3 md:col-span-2 xl:col-span-4">
          <Switch checked={draft.include_official_price_table !== false} onCheckedChange={(checked) => setDraft((row) => ({ ...row, include_official_price_table: checked }))} />
          <div className="space-y-1"><Label className="cursor-pointer">Incluir tabela Smart Dent (Loja Oficial) no final do PDF</Label><p className="text-xs text-muted-foreground">Anexa a tabela de preços oficial no mesmo formato usado nas revendas.</p></div>
        </div>
      </CardContent></Card>

      {persisted && <div className="space-y-4">
        <div className="flex items-center justify-between"><div><h3 className="font-semibold">Seções do combo</h3><p className="text-sm text-muted-foreground">Organize equipamentos, consumíveis, serviços, treinamentos ou qualquer outra composição.</p></div><Button variant="outline" onClick={addSection}><Plus className="mr-2 h-4 w-4" />Adicionar combo</Button></div>
        {sections.map((section, index) => (
          <Card key={section.id}><CardHeader className="pb-3"><div className="flex flex-wrap items-center gap-2"><Input className="min-w-[220px] flex-1 font-semibold" value={section.title} onChange={(e) => setSections((current) => current.map((row) => row.id === section.id ? { ...row, title: e.target.value } : row))} onBlur={(e) => updateSection(section.id, { title: e.target.value })} /><Button variant="ghost" size="icon" title="Mover para cima" onClick={() => moveSection(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Mover para baixo" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1}><ArrowDown className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Excluir combo" onClick={() => removeSection(section.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardHeader><CardContent className="space-y-3">
            <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Foto do combo</Label>
                {section.image_url
                  ? <img src={section.image_url} alt={`Foto do combo ${section.title}`} loading="lazy" className="h-36 w-full rounded-md border bg-white object-contain" />
                  : <div className="flex h-36 w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">Nenhuma foto enviada</div>}
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline" disabled={uploadingSection === section.id}>
                    <label className="cursor-pointer">
                      {uploadingSection === section.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                      {section.image_url ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadSectionImage(section.id, file); e.target.value = ""; }} />
                    </label>
                  </Button>
                  {section.image_url && <Button size="sm" variant="ghost" onClick={() => updateSection(section.id, { image_url: null })}>Remover</Button>}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Descrição do combo</Label>
                <Textarea rows={6} value={section.description || ""} placeholder="Explique o que o combo entrega, benefícios e condições" onChange={(e) => setSections((current) => current.map((row) => row.id === section.id ? { ...row, description: e.target.value } : row))} onBlur={(e) => updateSection(section.id, { description: e.target.value || null })} />
                <p className="text-xs text-muted-foreground">No PDF a foto aparece à esquerda e a descrição à direita, antes dos itens.</p>
              </div>
            </div>
            {section.items.map((item) => { const row = itemTotals(item); return <div key={item.id} className="grid items-end gap-2 rounded-md border p-3 md:grid-cols-[minmax(180px,2fr)_90px_140px_140px_100px_40px]"><div><Label className="text-xs">Item</Label><Input value={item.name} onChange={(e) => setSections((current) => current.map((s) => ({ ...s, items: s.items.map((i) => i.id === item.id ? { ...i, name: e.target.value } : i) })))} onBlur={(e) => updateItem(item.id, { name: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">{item.item_type === "catalog" ? item.sku || "Catálogo oficial" : "Linha personalizada"}</p></div><div><Label className="text-xs">Qtd.</Label><Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} /></div><div><Label className="text-xs">Valor mercado</Label><Input type="number" min="0" step="0.01" value={item.market_unit_price} onChange={(e) => updateItem(item.id, { market_unit_price: Number(e.target.value) })} /></div><div><Label className="text-xs">Valor promocional</Label><Input type="number" min="0" step="0.01" value={item.promotional_unit_price} onChange={(e) => updateItem(item.id, { promotional_unit_price: Number(e.target.value) })} /></div><div className="pb-2 text-right"><p className="text-xs text-muted-foreground">Desconto</p><p className="font-semibold">{row.discount.toFixed(1)}%</p></div><Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} title="Remover item"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>; })}
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openPicker(section.id)}><PackagePlus className="mr-2 h-4 w-4" />Produto do catálogo</Button><Button size="sm" variant="outline" onClick={() => { setCustomSection(section.id); setCustomOpen(true); }}><Plus className="mr-2 h-4 w-4" />Item personalizado</Button></div><div className="text-sm font-semibold">Subtotal: {money(section.items.reduce((sum, item) => sum + itemTotals(item).promotional, 0), draft.currency)}</div></div>
          </CardContent></Card>
        ))}
        {sections.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Adicione a primeira seção para começar a montar o combo.</CardContent></Card>}
        <Card className="border-primary/30"><CardContent className="grid gap-3 p-5 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Valor de mercado</p><p className="text-lg font-semibold">{money(totals.market, draft.currency)}</p></div><div><p className="text-xs text-muted-foreground">Economia total</p><p className="text-lg font-semibold text-destructive">{money(totals.market - totals.promotional, draft.currency)}</p></div><div><p className="text-xs text-muted-foreground">Valor promocional</p><p className="text-xl font-bold text-primary">{money(totals.promotional, draft.currency)}</p></div></CardContent></Card>
      </div>}

      <Dialog open={Boolean(pickerSection)} onOpenChange={(open) => !open && setPickerSection(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Adicionar produto do catálogo</DialogTitle><DialogDescription>Os dados atuais serão copiados para preservar esta promoção.</DialogDescription></DialogHeader><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Buscar produto, SKU ou apresentação" /></div><div className="max-h-[55vh] space-y-2 overflow-y-auto">{filteredCatalog.map((option) => <Button type="button" variant="outline" key={option.key} onClick={() => addCatalogItem(option)} className="h-auto w-full justify-between gap-3 p-3 text-left"><div><p className="font-medium">{option.name}</p><p className="text-xs text-muted-foreground">{[option.variation, option.sku].filter(Boolean).join(" • ") || "Produto"}</p></div><span className="font-semibold">{money(option.price, draft.currency)}</span></Button>)}</div></DialogContent></Dialog>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}><DialogContent><DialogHeader><DialogTitle>Adicionar item personalizado</DialogTitle><DialogDescription>Use para serviços, créditos, treinamentos ou benefícios.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Nome</Label><Input value={customItem.name} onChange={(e) => setCustomItem((row) => ({ ...row, name: e.target.value }))} /></div><div><Label>Descrição</Label><Textarea value={customItem.description} onChange={(e) => setCustomItem((row) => ({ ...row, description: e.target.value }))} /></div><div className="grid grid-cols-3 gap-3"><div><Label>Quantidade</Label><Input type="number" value={customItem.quantity} onChange={(e) => setCustomItem((row) => ({ ...row, quantity: e.target.value }))} /></div><div><Label>Valor mercado</Label><Input type="number" value={customItem.market} onChange={(e) => setCustomItem((row) => ({ ...row, market: e.target.value }))} /></div><div><Label>Valor promocional</Label><Input type="number" value={customItem.promotional} onChange={(e) => setCustomItem((row) => ({ ...row, promotional: e.target.value }))} /></div></div><Button className="w-full" onClick={addCustomItem}>Adicionar item</Button></div></DialogContent></Dialog>
    </div>
  );
}
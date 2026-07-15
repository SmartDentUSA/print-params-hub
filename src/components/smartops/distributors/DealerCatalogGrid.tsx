// Catálogo de produtos com VARIAÇÕES editáveis (presentation_qty, GTIN, NCM, Unidade,
// e preços BRL/USD/EUR por variação). Fonte mestre dos produtos: system_a_catalog
// (somente leitura aqui). As variações são gravadas em public.catalog_product_variations.
// Sincronização é INCREMENTAL — nunca sobrescreve linhas editadas manualmente.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ImageOff, Plus, Lock, Layers, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct } from "./types";
import { categoryRank, PRESENTATION_OPTIONS, type PresentationType } from "./types";

/** Extrai variações a partir de system_a_catalog.extra_data.system_a_live.technical_specs. */
function parseSpecVariations(specs: Array<{ label: string; value: string }>): {
  ncm: string | null;
  variations: Array<{ qty: string; gtin: string | null; unit: string | null }>;
} {
  const rows = Array.isArray(specs) ? specs : [];
  let ncm: string | null = null;
  const gtinByQty = new Map<string, string>();
  const order: string[] = [];
  let available: string[] = [];
  for (const r of rows) {
    const label = String(r?.label || "").trim();
    const value = String(r?.value || "").trim();
    if (!label) continue;
    if (/^NCM\b/i.test(label) && !ncm) { ncm = value || null; continue; }
    if (/^Varia[cç][oõ]es dispon[ií]veis/i.test(label)) {
      available = value.split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
      continue;
    }
    const m = label.match(/^GTIN\/EAN\s*[—–-]\s*(.+)$/i);
    if (m) {
      const qty = m[1].trim();
      if (!gtinByQty.has(qty)) order.push(qty);
      if (value) gtinByQty.set(qty, value);
    }
  }
  const qtys = order.length > 0 ? order : available;
  const unitFor = (qty: string): string | null => {
    const s = qty.toLowerCase().replace(/\s+/g, "");
    if (/kg$/.test(s)) return "kg";
    if (/g$/.test(s)) return "g";
    if (/ml$/.test(s)) return "ml";
    if (/l$/.test(s)) return "L";
    if (/un(id)?$/.test(s)) return "UN";
    return null;
  };
  return {
    ncm,
    variations: qtys.map((qty) => ({
      qty,
      gtin: gtinByQty.get(qty) || null,
      unit: unitFor(qty),
    })),
  };
}

type Variation = {
  id: string;
  catalog_product_id: string;
  presentation_qty: string;
  sku: string | null;
  gtin_ean: string | null;
  ncm_hs: string | null;
  unidade: string;
  presentation: PresentationType | null;
  weight_kg: number | null;
  dimensions_cm: string | null;
  price_brl: number | null;
  price_usd: number | null;
  price_eur: number | null;
  sort_order: number;
  source: string;
};

const I18N: Record<string, Record<string, string>> = {
  pt: {
    search: "Buscar produto…", cat: "Categoria", allCats: "Todas categorias",
    items: "itens", showInactive: "Mostrar inativos",
    catStatus: "Status", catPhoto: "Foto", catCod: "COD", catSku: "SKU", catProduct: "Produto",
    catPresQty: "Variação", catPres: "Pres", catNcm: "NCM/HS", catGtin: "GTIN/EAN",
    catUnit: "Unidade", catWeight: "Peso (kg)", catDims: "Dimensões (cm)",
    priceBRL: "Preço BRL", priceUSD: "Preço USD", priceEUR: "Preço EUR",
    empty: "Nenhum produto encontrado.", loading: "Carregando catálogo…",
    activated: "Ativado", deactivated: "Desativado", addVariation: "Adicionar variação",
    syncVariations: "Sincronizar do Sistema A",
    syncTip: "Puxa variações (GTIN, NCM, Unidade) dos cards do Sistema A. Incremental — nunca sobrescreve dados existentes.",
    readonly: "Cadastro/edição do produto mestre é em Base de Conhecimento → Catálogo. Aqui você mantém as VARIAÇÕES (250g, 500g, 1kg…) e seus preços em BRL/USD/EUR, usados por todos os distribuidores.",
    saveAll: "Salvar alterações", saved: "Salvo", saving: "Salvando…",
    unsaved: "não salvas",
    noVariations: "Sem variações. Clique em “Sincronizar do Sistema A” ou “Adicionar variação”.",
    variantPlaceholder: "ex.: 1kg",
    confirmDelete: "Remover esta variação?",
  },
  es: {
    search: "Buscar producto…", cat: "Categoría", allCats: "Todas las categorías",
    items: "ítems", showInactive: "Mostrar inactivos",
    catStatus: "Estado", catPhoto: "Foto", catCod: "COD", catSku: "SKU", catProduct: "Producto",
    catPresQty: "Variación", catPres: "Pres", catNcm: "NCM/HS", catGtin: "GTIN/EAN",
    catUnit: "Unidad", catWeight: "Peso (kg)", catDims: "Dimensiones (cm)",
    priceBRL: "Precio BRL", priceUSD: "Precio USD", priceEUR: "Precio EUR",
    empty: "Ningún producto encontrado.", loading: "Cargando catálogo…",
    activated: "Activado", deactivated: "Desactivado", addVariation: "Agregar variación",
    syncVariations: "Sincronizar del Sistema A",
    syncTip: "Trae variaciones (GTIN, NCM, Unidad) del Sistema A. Incremental — nunca sobrescribe datos existentes.",
    readonly: "El producto maestro se edita en Base de Conocimiento → Catálogo. Aquí mantiene las VARIACIONES (250g, 500g, 1kg…) y sus precios en BRL/USD/EUR, usados por todos los distribuidores.",
    saveAll: "Guardar cambios", saved: "Guardado", saving: "Guardando…",
    unsaved: "sin guardar",
    noVariations: "Sin variaciones. Use “Sincronizar del Sistema A” o “Agregar variación”.",
    variantPlaceholder: "ej.: 1kg",
    confirmDelete: "¿Eliminar esta variación?",
  },
  en: {
    search: "Search product…", cat: "Category", allCats: "All categories",
    items: "items", showInactive: "Show inactive",
    catStatus: "Status", catPhoto: "Photo", catCod: "COD", catSku: "SKU", catProduct: "Product",
    catPresQty: "Variant", catPres: "Pres", catNcm: "HS Code", catGtin: "GTIN/EAN",
    catUnit: "Unit", catWeight: "Weight (kg)", catDims: "Dimensions (cm)",
    priceBRL: "Price BRL", priceUSD: "Price USD", priceEUR: "Price EUR",
    empty: "No products found.", loading: "Loading catalog…",
    activated: "Enabled", deactivated: "Disabled", addVariation: "Add variant",
    syncVariations: "Sync from System A",
    syncTip: "Pulls variants (GTIN, HS Code, Unit) from System A cards. Incremental — never overwrites existing data.",
    readonly: "Master product editing lives in Knowledge Base → Catalog. Here you maintain the VARIANTS (250g, 500g, 1kg…) and their prices in BRL/USD/EUR, shared across all distributors.",
    saveAll: "Save changes", saved: "Saved", saving: "Saving…",
    unsaved: "unsaved",
    noVariations: "No variants. Click “Sync from System A” or “Add variant”.",
    variantPlaceholder: "e.g., 1kg",
    confirmDelete: "Remove this variant?",
  },
};

type Props = {
  onAddToPriceList?: (product: CatalogProduct) => void;
};

export function DealerCatalogGrid({ onAddToPriceList }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [lang, setLang] = useState<"pt" | "en" | "es">("pt");
  const [showInactive, setShowInactive] = useState(false);

  const t = I18N[lang] || I18N.pt;

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [prodRes, varRes] = await Promise.all([
      supabase
        .from("system_a_catalog" as any)
        .select("id,external_id,name,name_en,name_es,slug,category,product_category,product_subcategory,image_url,price,price_usd,price_eur,ncm,gtin,presentation,presentation_qty,quantity_multiplier,currency,description,active,extra_data")
        .not("product_category", "is", null)
        .neq("product_category", "")
        .order("product_category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("catalog_product_variations" as any)
        .select("*")
        .order("catalog_product_id", { ascending: true })
        .order("sort_order", { ascending: true }),
    ]);
    if (prodRes.error) toast.error("Erro ao carregar catálogo: " + prodRes.error.message);
    if (varRes.error) toast.error("Erro ao carregar variações: " + varRes.error.message);
    setItems(((prodRes.data as any) || []) as any[]);
    setVariations(((varRes.data as any) || []) as Variation[]);
    setDirtyIds(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.product_category && s.add(i.product_category));
    return [
      "all",
      ...Array.from(s).sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b)),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter((i) => {
      if (!showInactive && !i.active) return false;
      if (category !== "all" && i.product_category !== category) return false;
      if (!needle) return true;
      const hay = [i.name, i.name_en, i.name_es, i.product_category, i.product_subcategory, i.external_id, i.slug].join(" ").toLowerCase();
      return hay.includes(needle);
    });
    return list.sort((a, b) => {
      const ra = categoryRank(a.product_category, a.product_subcategory);
      const rb = categoryRank(b.product_category, b.product_subcategory);
      if (ra !== rb) return ra - rb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [items, q, category, showInactive]);

  const varsByProduct = useMemo(() => {
    const map = new Map<string, Variation[]>();
    for (const v of variations) {
      if (!map.has(v.catalog_product_id)) map.set(v.catalog_product_id, []);
      map.get(v.catalog_product_id)!.push(v);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [variations]);

  const nameFor = (p: any) => (lang === "en" ? p.name_en || p.name : lang === "es" ? p.name_es || p.name : p.name);
  const codOf = (p: any) => p?.external_id || "—";
  const skuOf = (p: any) =>
    p?.extra_data?.sku ||
    p?.extra_data?.SKU ||
    p?.extra_data?.sku_pai ||
    p?.extra_data?.system_a_live?.sku ||
    "—";

  const patchVariation = (id: string, patch: Partial<Variation>) => {
    setVariations((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    setDirtyIds((s) => new Set(s).add(id));
  };

  const parseNum = (raw: any): number | null => {
    if (raw === "" || raw === null || raw === undefined) return null;
    const n = Number(String(raw).replace(",", "."));
    return isFinite(n) ? n : null;
  };

  const addVariation = async (productId: string) => {
    const list = varsByProduct.get(productId) || [];
    const nextSort = (list[list.length - 1]?.sort_order ?? 0) + 1;
    const product = items.find((i) => i.id === productId);
    // Garante presentation_qty único (constraint UNIQUE(catalog_product_id, presentation_qty))
    const existingQtys = new Set(
      list.map((v) => (v.presentation_qty || "").trim().toLowerCase()),
    );
    let seedQty = "Nova";
    let n = 1;
    while (existingQtys.has(seedQty.toLowerCase())) {
      n += 1;
      seedQty = `Nova ${n}`;
    }
    const seed: any = {
      catalog_product_id: productId,
      presentation_qty: seedQty,
      unidade: "UN",
      presentation: "Item",
      sort_order: nextSort,
      source: "manual",
      ncm_hs: product?.ncm ?? null,
      sku: null,
      price_brl: product?.price ?? null,
      price_usd: product?.price_usd ?? null,
      price_eur: product?.price_eur ?? null,
    };
    const { data, error } = await supabase
      .from("catalog_product_variations" as any)
      .insert(seed)
      .select("*")
      .single();
    if (error) {
      if ((error as any).code === "23505") {
        toast.error("Já existe uma variação com essa apresentação para este produto. Edite a existente.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    setVariations((prev) => [...prev, data as unknown as Variation]);
  };

  const removeVariation = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    const { error } = await supabase.from("catalog_product_variations" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setVariations((prev) => prev.filter((v) => v.id !== id));
    setDirtyIds((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const saveAll = async () => {
    if (dirtyIds.size === 0) return;
    setSaving(true);
    const toSave = variations.filter((v) => dirtyIds.has(v.id));
    for (const v of toSave) {
      const { error } = await supabase
        .from("catalog_product_variations" as any)
        .update({
          presentation_qty: v.presentation_qty,
          sku: v.sku,
          gtin_ean: v.gtin_ean,
          ncm_hs: v.ncm_hs,
          unidade: v.unidade || "UN",
          presentation: v.presentation ?? null,
          price_brl: v.price_brl,
          price_usd: v.price_usd,
          price_eur: v.price_eur,
        })
        .eq("id", v.id);
      if (error) { toast.error(`Erro: ${error.message}`); setSaving(false); return; }
    }
    toast.success(`${toSave.length} variações salvas`);
    setDirtyIds(new Set());
    setSaving(false);
  };

  /** INCREMENTAL: só INSERT de (produto, presentation_qty) que ainda não existem. */
  const syncFromSystemA = async () => {
    setSyncing(true);
    const existing = new Set(
      variations.map((v) => `${v.catalog_product_id}::${(v.presentation_qty || "").toLowerCase().replace(/\s+/g, "")}`),
    );
    const toInsert: any[] = [];
    let productsWithSpecs = 0;
    for (const p of items) {
      // Produtos onde a variante (cor/sabor/etc.) já está no NOME do próprio produto
      // NÃO devem receber variações do card mestre (senão vira 20 linhas por cor).
      // Ex.: "Atos Resina Composta Direta - DA1", "Resina Atos Academic - Amarelo".
      const nm = String(p?.name || "");
      if (
        /^Atos Resina Composta Direta\s*-\s*/i.test(nm) ||
        /^Resina Atos Academic\s*-\s*/i.test(nm) ||
        /^ATOS Block\s*-\s*/i.test(nm)
      ) continue;
      const specs = (p?.extra_data?.system_a_live?.technical_specs ?? []) as Array<{ label: string; value: string }>;
      const parsed = parseSpecVariations(specs);
      if (parsed.variations.length === 0) continue;
      productsWithSpecs++;
      parsed.variations.forEach((v, idx) => {
        const key = `${p.id}::${v.qty.toLowerCase().replace(/\s+/g, "")}`;
        if (existing.has(key)) return;
        toInsert.push({
          catalog_product_id: p.id,
          presentation_qty: v.qty,
          gtin_ean: v.gtin,
          ncm_hs: parsed.ncm ?? p.ncm ?? null,
          unidade: v.unit || "UN",
          price_brl: p.price ?? null,
          price_usd: p.price_usd ?? null,
          price_eur: p.price_eur ?? null,
          sort_order: idx,
          source: "system_a_sync",
        });
      });
    }
    if (toInsert.length === 0) {
      toast.info(`Sem novas variações a importar (${productsWithSpecs} produto(s) analisado(s)).`);
      setSyncing(false);
      return;
    }
    const { error } = await supabase.from("catalog_product_variations" as any).insert(toInsert);
    if (error) { toast.error(error.message); setSyncing(false); return; }
    toast.success(`${toInsert.length} variações importadas incrementalmente`);
    await loadAll();
    setSyncing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder={t.cat} /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c === "all" ? t.allCats : c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lang} onValueChange={(v) => setLang(v as any)}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pt">🇧🇷 PT</SelectItem>
            <SelectItem value="en">🇺🇸 EN</SelectItem>
            <SelectItem value="es">🇪🇸 ES</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 pl-2 border-l">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <label htmlFor="show-inactive" className="text-xs text-muted-foreground cursor-pointer select-none">{t.showInactive}</label>
        </div>
        <Button
          variant="outline"
          onClick={syncFromSystemA}
          disabled={syncing || loading}
          title={t.syncTip}
        >
          {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Layers className="w-4 h-4 mr-1" />}
          {t.syncVariations}
        </Button>
        <Button onClick={saveAll} disabled={saving || dirtyIds.size === 0}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          {dirtyIds.size > 0 ? `${t.saveAll} (${dirtyIds.size})` : t.saved}
        </Button>
        <Badge variant="outline">{filtered.length} {t.items}</Badge>
        <Badge variant="secondary">{variations.length} variações</Badge>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 p-2 text-[11px] text-muted-foreground">
        <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{t.readonly}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[2050px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">{t.catStatus}</TableHead>
                <TableHead className="w-[64px]">{t.catPhoto}</TableHead>
                <TableHead className="min-w-[260px]">{t.catProduct}</TableHead>
                <TableHead className="w-[110px]">{t.catCod}</TableHead>
                <TableHead className="w-[120px]">{t.catSku}</TableHead>
                <TableHead className="w-[110px]">{t.catPresQty}</TableHead>
                <TableHead className="w-[90px]">{t.catPres}</TableHead>
                <TableHead className="w-[130px]">{t.catNcm}</TableHead>
                <TableHead className="w-[150px]">{t.catGtin}</TableHead>
                <TableHead className="w-[110px]">{t.catWeight}</TableHead>
                <TableHead className="w-[130px]">{t.catDims}</TableHead>
                <TableHead className="w-[90px]">{t.catUnit}</TableHead>
                <TableHead className="w-[120px] text-right">{t.priceBRL}</TableHead>
                <TableHead className="w-[120px] text-right">{t.priceUSD}</TableHead>
                <TableHead className="w-[120px] text-right">{t.priceEUR}</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                    {t.empty}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.flatMap((p) => {
                  const vars = varsByProduct.get(p.id) || [];
                  if (vars.length === 0) {
                    return [
                      <TableRow key={p.id} className={p.active ? "" : "opacity-50"}>
                        <TableCell>
                          <Badge variant={p.active ? "default" : "outline"} className="text-[10px]">
                            {p.active ? t.activated : t.deactivated}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                            {p.image_url ? (
                              <img src={p.image_url} alt={nameFor(p)} className="w-full h-full object-contain p-1" loading="lazy" />
                            ) : (
                              <ImageOff className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="truncate">{nameFor(p)}</div>
                          {p.product_category && <div className="text-[11px] text-muted-foreground truncate">{p.product_category}{p.product_subcategory ? ` › ${p.product_subcategory}` : ""}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{codOf(p)}</TableCell>
                        <TableCell colSpan={10} className="text-xs text-muted-foreground italic">
                          {t.noVariations}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => addVariation(p.id)}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>,
                    ];
                  }
                  return vars.map((v, idx) => {
                    const isLead = idx === 0;
                    const span = vars.length;
                    return (
                      <TableRow key={v.id} className={p.active ? "" : "opacity-50"}>
                        {isLead && (
                          <>
                            <TableCell rowSpan={span}>
                              <Badge variant={p.active ? "default" : "outline"} className="text-[10px]">
                                {p.active ? t.activated : t.deactivated}
                              </Badge>
                            </TableCell>
                            <TableCell rowSpan={span}>
                              <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={nameFor(p)} className="w-full h-full object-contain p-1" loading="lazy" />
                                ) : (
                                  <ImageOff className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell rowSpan={span} className="font-medium">
                              <div className="truncate">{nameFor(p)}</div>
                              {p.product_category && <div className="text-[11px] text-muted-foreground truncate">{p.product_category}{p.product_subcategory ? ` › ${p.product_subcategory}` : ""}</div>}
                              <Button size="sm" variant="ghost" className="mt-1 h-6 px-1 text-[10px]" onClick={() => addVariation(p.id)}>
                                <Plus className="w-3 h-3 mr-0.5" /> {t.addVariation}
                              </Button>
                            </TableCell>
                            <TableCell rowSpan={span} className="font-mono text-xs">{codOf(p)}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <Input
                            className="h-8 text-xs font-mono"
                            value={v.sku ?? ""}
                            placeholder={skuOf(p) !== "—" ? skuOf(p) : "SKU"}
                            onChange={(e) => patchVariation(v.id, { sku: e.target.value || null })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            value={v.presentation_qty ?? ""}
                            placeholder={t.variantPlaceholder}
                            onChange={(e) => patchVariation(v.id, { presentation_qty: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={v.presentation ?? "Item"}
                            onValueChange={(val) => patchVariation(v.id, { presentation: val as PresentationType })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRESENTATION_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs font-mono"
                            value={v.ncm_hs ?? ""}
                            onChange={(e) => patchVariation(v.id, { ncm_hs: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs font-mono"
                            value={v.gtin_ean ?? ""}
                            onChange={(e) => patchVariation(v.id, { gtin_ean: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            value={v.unidade ?? ""}
                            onChange={(e) => patchVariation(v.id, { unidade: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs text-right"
                            inputMode="decimal"
                            value={v.price_brl ?? ""}
                            onChange={(e) => patchVariation(v.id, { price_brl: parseNum(e.target.value) })}
                            placeholder="R$"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs text-right"
                            inputMode="decimal"
                            value={v.price_usd ?? ""}
                            onChange={(e) => patchVariation(v.id, { price_usd: parseNum(e.target.value) })}
                            placeholder="US$"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs text-right"
                            inputMode="decimal"
                            value={v.price_eur ?? ""}
                            onChange={(e) => patchVariation(v.id, { price_eur: parseNum(e.target.value) })}
                            placeholder="€"
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeVariation(v.id)} title={t.confirmDelete}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
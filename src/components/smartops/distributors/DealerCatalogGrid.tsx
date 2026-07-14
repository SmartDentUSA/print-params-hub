import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ImageOff, Plus } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct } from "./types";
import { PRESENTATION_OPTIONS } from "./types";

const I18N: Record<string, Record<string, string>> = {
  pt: {
    search: "Buscar produto…", cat: "Categoria", allCats: "Todas categorias",
    items: "itens", showInactive: "Mostrar inativos",
    catStatus: "Status", catPhoto: "Foto", catCod: "COD", catProduct: "Produto",
    catPresQty: "Pres #", catPres: "Pres", catNcm: "NCM/HS", catGtin: "GTIN/EAN",
    catUnit: "Unid (×)", catTablePrice: "Preço tabela",
    empty: "Nenhum produto encontrado.", loading: "Carregando catálogo…",
    activated: "Ativado", deactivated: "Desativado", add: "Adicionar",
  },
  es: {
    search: "Buscar producto…", cat: "Categoría", allCats: "Todas las categorías",
    items: "ítems", showInactive: "Mostrar inactivos",
    catStatus: "Estado", catPhoto: "Foto", catCod: "COD", catProduct: "Producto",
    catPresQty: "Pres #", catPres: "Pres", catNcm: "NCM/HS", catGtin: "GTIN/EAN",
    catUnit: "Unid (×)", catTablePrice: "Precio tabla",
    empty: "Ningún producto encontrado.", loading: "Cargando catálogo…",
    activated: "Activado", deactivated: "Desactivado", add: "Agregar",
  },
  en: {
    search: "Search product…", cat: "Category", allCats: "All categories",
    items: "items", showInactive: "Show inactive",
    catStatus: "Status", catPhoto: "Photo", catCod: "COD", catProduct: "Product",
    catPresQty: "Pres #", catPres: "Pres", catNcm: "HS Code", catGtin: "GTIN/EAN",
    catUnit: "Qty (×)", catTablePrice: "List price",
    empty: "No products found.", loading: "Loading catalog…",
    activated: "Enabled", deactivated: "Disabled", add: "Add",
  },
};

type Props = {
  onAddToPriceList?: (product: CatalogProduct) => void;
};

export function DealerCatalogGrid({ onAddToPriceList }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [lang, setLang] = useState<"pt" | "en" | "es">("pt");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const t = I18N[lang] || I18N.pt;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("system_a_catalog" as any)
        .select("id,external_id,name,name_en,name_es,slug,category,product_category,product_subcategory,image_url,price,price_usd,price_eur,ncm,gtin,presentation,presentation_qty,quantity_multiplier,currency,description,active,extra_data")
        .not("product_category", "is", null)
        .neq("product_category", "")
        .order("product_category", { ascending: true })
        .order("name", { ascending: true });
      if (error) toast.error("Erro ao carregar catálogo: " + error.message);
      setItems(((data as any) || []) as any[]);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.product_category && s.add(i.product_category));
    return ["all", ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (!showInactive && !i.active) return false;
      if (category !== "all" && i.product_category !== category) return false;
      if (!needle) return true;
      const hay = [i.name, i.name_en, i.name_es, i.product_category, i.product_subcategory, i.external_id, i.slug].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, category, showInactive]);

  const nameFor = (p: any) => (lang === "en" ? p.name_en || p.name : lang === "es" ? p.name_es || p.name : p.name);
  const skuOf = (p: any) => p?.extra_data?.sku || p?.extra_data?.SKU || p?.extra_data?.sku_pai || p?.external_id || "—";
  const ncmOf = (p: any) => p?.ncm ?? p?.extra_data?.ncm ?? p?.extra_data?.NCM ?? "";
  const gtinOf = (p: any) => p?.gtin ?? p?.extra_data?.gtin ?? p?.extra_data?.ean ?? p?.extra_data?.GTIN ?? p?.extra_data?.EAN ?? "";

  const updateLocal = (id: string, patch: Record<string, any>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const saveField = async (id: string, patch: Record<string, any>) => {
    setSavingId(id);
    const { error } = await supabase.from("system_a_catalog" as any).update(patch).eq("id", id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
  };

  const parseNum = (v: string) => {
    const s = v.replace(",", ".").trim();
    if (!s) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };

  const toggleActive = async (p: any, next: boolean) => {
    updateLocal(p.id, { active: next });
    await saveField(p.id, { active: next });
    toast.success(next ? t.activated : t.deactivated);
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
        <Badge variant="outline">{filtered.length} {t.items}</Badge>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[1600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">{t.catStatus}</TableHead>
                <TableHead className="w-[64px]">{t.catPhoto}</TableHead>
                <TableHead className="w-[110px]">{t.catCod}</TableHead>
                <TableHead className="min-w-[260px]">{t.catProduct}</TableHead>
                <TableHead className="w-[80px]">{t.catPresQty}</TableHead>
                <TableHead className="w-[100px]">{t.catPres}</TableHead>
                <TableHead className="w-[130px]">{t.catNcm}</TableHead>
                <TableHead className="w-[150px]">{t.catGtin}</TableHead>
                <TableHead className="w-[80px]">{t.catUnit}</TableHead>
                <TableHead className="w-[220px] text-right">{t.catTablePrice}</TableHead>
                {onAddToPriceList && <TableHead className="w-[120px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onAddToPriceList ? 11 : 10} className="text-center py-8 text-muted-foreground">
                    {t.empty}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className={p.active ? "" : "opacity-50"}>
                    <TableCell>
                      <Switch
                        checked={!!p.active}
                        onCheckedChange={(v) => toggleActive(p, v)}
                      />
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
                    <TableCell className="font-mono text-xs">{skuOf(p)}</TableCell>
                    <TableCell className="font-medium max-w-[320px]">
                      <div className="truncate">{nameFor(p)}</div>
                      {p.product_category && <div className="text-[11px] text-muted-foreground truncate">{p.product_category}{p.product_subcategory ? ` › ${p.product_subcategory}` : ""}</div>}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={p.presentation_qty ?? ""}
                        placeholder="—"
                        onChange={(e) => updateLocal(p.id, { presentation_qty: e.target.value })}
                        onBlur={(e) => saveField(p.id, { presentation_qty: parseNum(e.target.value) })}
                        className="h-8 text-right text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.presentation ?? ""}
                        onValueChange={(v) => { updateLocal(p.id, { presentation: v }); saveField(p.id, { presentation: v }); }}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {PRESENTATION_OPTIONS.map((op) => (
                            <SelectItem key={op} value={op}>{op}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={ncmOf(p)}
                        onChange={(e) => updateLocal(p.id, { ncm: e.target.value })}
                        onBlur={(e) => saveField(p.id, { ncm: e.target.value || null })}
                        className="h-8 font-mono text-xs"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={gtinOf(p)}
                        onChange={(e) => updateLocal(p.id, { gtin: e.target.value })}
                        onBlur={(e) => saveField(p.id, { gtin: e.target.value || null })}
                        className="h-8 font-mono text-xs"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={p.quantity_multiplier ?? ""}
                        placeholder="1"
                        onChange={(e) => updateLocal(p.id, { quantity_multiplier: e.target.value })}
                        onBlur={(e) => saveField(p.id, { quantity_multiplier: parseNum(e.target.value) })}
                        className="h-8 text-right text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground w-8">R$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={p.price ?? ""}
                            onChange={(e) => updateLocal(p.id, { price: e.target.value })}
                            onBlur={(e) => saveField(p.id, { price: parseNum(e.target.value) })}
                            className="h-7 text-right text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground w-8">US$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={p.price_usd ?? ""}
                            onChange={(e) => updateLocal(p.id, { price_usd: e.target.value })}
                            onBlur={(e) => saveField(p.id, { price_usd: parseNum(e.target.value) })}
                            className="h-7 text-right text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground w-8">€</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={p.price_eur ?? ""}
                            onChange={(e) => updateLocal(p.id, { price_eur: e.target.value })}
                            onBlur={(e) => saveField(p.id, { price_eur: parseNum(e.target.value) })}
                            className="h-7 text-right text-xs"
                          />
                        </div>
                      </div>
                    </TableCell>
                    {onAddToPriceList && (
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => onAddToPriceList(p)} disabled={savingId === p.id}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> {t.add}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
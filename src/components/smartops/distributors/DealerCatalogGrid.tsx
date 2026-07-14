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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("system_a_catalog" as any)
        .select("id,external_id,name,name_en,name_es,slug,category,product_category,product_subcategory,image_url,price,price_usd,price_eur,ncm,gtin,currency,description,active,extra_data")
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
      if (category !== "all" && i.product_category !== category) return false;
      if (!needle) return true;
      const hay = [i.name, i.name_en, i.name_es, i.product_category, i.product_subcategory, i.external_id, i.slug].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, category]);

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
    toast.success(next ? "Ativado" : "Desativado");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c === "all" ? "Todas categorias" : c}</SelectItem>
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
        <Badge variant="outline">{filtered.length} itens</Badge>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[64px]">Foto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Subcategoria</TableHead>
                <TableHead className="w-[130px]">NCM/HS</TableHead>
                <TableHead className="w-[150px]">GTIN/EAN</TableHead>
                <TableHead className="w-[260px] text-right">Preço tabela</TableHead>
                {onAddToPriceList && <TableHead className="w-[120px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onAddToPriceList ? 10 : 9} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado.
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
                      {p.slug && <div className="text-[11px] text-muted-foreground font-mono truncate">/{p.slug}</div>}
                    </TableCell>
                    <TableCell>
                      {p.product_category ? <Badge variant="outline">{p.product_category}</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.product_subcategory || "—"}</TableCell>
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
                          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
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
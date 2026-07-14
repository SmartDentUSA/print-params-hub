import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ImageOff, Plus } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct } from "./types";
import { formatMoney } from "./types";

type Props = {
  onAddToPriceList?: (product: CatalogProduct) => void;
};

export function DealerCatalogGrid({ onAddToPriceList }: Props) {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [lang, setLang] = useState<"pt" | "en" | "es">("pt");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("system_a_catalog" as any)
        .select("id,name,name_en,name_es,category,product_category,product_subcategory,image_url,price,currency,description,active")
        .eq("active", true)
        .not("product_category", "is", null)
        .neq("product_category", "")
        .order("product_category", { ascending: true })
        .order("name", { ascending: true });
      if (error) toast.error("Erro ao carregar catálogo: " + error.message);
      setItems(((data as any) || []) as CatalogProduct[]);
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
      const hay = [i.name, i.name_en, i.name_es, i.product_category, i.product_subcategory].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, category]);

  const nameFor = (p: CatalogProduct) => (lang === "en" ? p.name_en || p.name : lang === "es" ? p.name_es || p.name : p.name);

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden hover:shadow-md transition flex flex-col">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={nameFor(p)} className="w-full h-full object-contain" loading="lazy" />
                ) : (
                  <ImageOff className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <CardContent className="p-3 space-y-1.5 flex-1 flex flex-col">
                <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">
                  {p.product_category || "—"}
                </p>
                <p className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]">{nameFor(p)}</p>
                <p className="text-sm font-semibold text-primary mt-auto">
                  {formatMoney(p.price, p.currency || "BRL")}
                </p>
                {onAddToPriceList && (
                  <Button size="sm" variant="outline" className="mt-1" onClick={() => onAddToPriceList(p)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar à tabela
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum produto encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
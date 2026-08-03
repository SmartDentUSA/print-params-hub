import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown, Save, Search, Sparkles, X, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useSkuMappingInbox,
  type CatalogVariationOption,
  type SkuInboxRow,
} from "@/hooks/useSkuMappingInbox";

function formatBRL(n: number) {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function norm(s?: string | null) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s?: string | null) {
  return norm(s).split(" ").filter((t) => t.length > 2);
}

/** Naive token-overlap suggestion against the catalog. */
function suggest(name: string, variations: CatalogVariationOption[]) {
  const t = tokens(name);
  if (!t.length) return null;
  let best: { v: CatalogVariationOption; score: number } | null = null;
  for (const v of variations) {
    const label = [v.parent_name, v.presentation, v.color].filter(Boolean).join(" ");
    const vt = tokens(label);
    if (!vt.length) continue;
    const hits = t.filter((x) => vt.includes(x)).length;
    const score = hits / Math.max(t.length, 1);
    if (score > 0.34 && (!best || score > best.score)) best = { v, score };
  }
  return best;
}

function VariationPicker({
  variations,
  onSelect,
  current,
}: {
  variations: CatalogVariationOption[];
  onSelect: (v: CatalogVariationOption) => void;
  current: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = norm(search);
    if (!s) return variations.slice(0, 40);
    return variations
      .filter((v) =>
        norm([v.parent_name, v.presentation, v.sku, v.color, v.parent_category].filter(Boolean).join(" ")).includes(s),
      )
      .slice(0, 40);
  }, [variations, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="justify-between h-8 text-xs font-normal min-w-[200px]">
          <span className="truncate">{current || "Selecionar do catálogo..."}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no catálogo..."
              className="h-8 pl-7 text-xs"
            />
            {search && (
              <X
                className="absolute right-2 top-2.5 h-3.5 w-3.5 cursor-pointer text-muted-foreground"
                onClick={() => setSearch("")}
              />
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="p-1">
            {filtered.map((v) => (
              <button
                type="button"
                key={v.id}
                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent text-left"
                onClick={() => {
                  onSelect(v);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("h-3 w-3", current === v.sku ? "opacity-100" : "opacity-0")} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.parent_name || v.presentation || v.sku}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {[v.sku, v.presentation, v.color, v.parent_category].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">Nenhum resultado</div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function OffCatalogTab() {
  const { rows, variations, loading, load, saveMapping, saveCanonicalName } = useSkuMappingInbox();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState<"gmv" | "occurrences" | "name">("gmv");
  const [visibleCount, setVisibleCount] = useState(100);
  const [picked, setPicked] = useState<Record<string, CatalogVariationOption>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [cats, setCats] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<Record<string, string>>({});

  // Listas oficiais de categoria/subcategoria vindas do catálogo.
  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    variations.forEach((v) => v.parent_category && s.add(v.parent_category.trim()));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [variations]);

  const subcategoryOptions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    variations.forEach((v) => {
      if (!v.parent_subcategory) return;
      const key = (v.parent_category || "").trim();
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(v.parent_subcategory.trim());
    });
    return map;
  }, [variations]);

  const subOptionsFor = (categoria: string) => {
    const exact = subcategoryOptions.get((categoria || "").trim());
    if (exact && exact.size) return Array.from(exact).sort((a, b) => a.localeCompare(b));
    const all = new Set<string>();
    subcategoryOptions.forEach((set) => set.forEach((x) => all.add(x)));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  };

  // Catalog fingerprints (names + skus) to detect "not in catalog".
  const catalogIndex = useMemo(() => {
    const set = new Set<string>();
    for (const v of variations) {
      if (v.parent_name) set.add(norm(v.parent_name));
      if (v.presentation) set.add(norm(v.presentation));
      if (v.sku) set.add(norm(v.sku));
      if (v.parent_name && v.presentation) set.add(norm(`${v.parent_name} ${v.presentation}`));
    }
    return set;
  }, [variations]);

  const offCatalog = useMemo(() => {
    let list = rows.filter((r) => {
      if (!r.sources?.includes("deal_items")) return false; // apenas propostas do CRM
      if (r.sku_interno) return false; // já mapeado a um SKU do catálogo
      if (r.is_kit) return false; // kits têm fluxo próprio
      const n = norm(r.sample_name);
      if (catalogIndex.has(n)) return false;
      if (r.sample_sku && catalogIndex.has(norm(r.sample_sku))) return false;
      return true;
    });
    if (search) {
      const s = norm(search);
      list = list.filter(
        (r) =>
          norm(r.sample_name).includes(s) ||
          norm(r.sample_code).includes(s) ||
          norm(r.nome_canonico).includes(s),
      );
    }
    list.sort((a, b) => {
      if (orderBy === "gmv") return Number(b.gmv) - Number(a.gmv);
      if (orderBy === "occurrences") return Number(b.occurrences) - Number(a.occurrences);
      return (a.sample_name || "").localeCompare(b.sample_name || "");
    });
    return list;
  }, [rows, catalogIndex, search, orderBy]);

  const visibleRows = useMemo(() => offCatalog.slice(0, visibleCount), [offCatalog, visibleCount]);

  const totals = useMemo(
    () => ({
      count: offCatalog.length,
      gmv: offCatalog.reduce((s, r) => s + Number(r.gmv || 0), 0),
      named: offCatalog.filter((r) => !!r.nome_canonico || resolved[r.name_key]).length,
      classified: offCatalog.filter(
        (r) => !!(cats[r.name_key] ?? r.categoria) && !!(subs[r.name_key] ?? r.subcategoria),
      ).length,
    }),
    [offCatalog, resolved, cats, subs],
  );

  const handleLinkCatalog = async (row: SkuInboxRow, v: CatalogVariationOption) => {
    setSavingKey(row.name_key);
    try {
      await saveMapping(row, v, false);
      setCats((c) => ({ ...c, [row.name_key]: v.parent_category || c[row.name_key] || "" }));
      setSubs((c) => ({ ...c, [row.name_key]: v.parent_subcategory || c[row.name_key] || "" }));
      setResolved((c) => ({ ...c, [row.name_key]: v.sku || v.parent_name || "vinculado" }));
      toast({ title: "✅ Vinculado ao catálogo", description: v.parent_name || v.sku || "" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateName = async (row: SkuInboxRow) => {
    const value = (names[row.name_key] ?? row.nome_canonico ?? row.sample_name).trim();
    const categoria = (cats[row.name_key] ?? row.categoria ?? "").trim() || null;
    const subcategoria = (subs[row.name_key] ?? row.subcategoria ?? "").trim() || null;
    setSavingKey(row.name_key);
    try {
      await saveCanonicalName(row, value, categoria, subcategoria);
      setResolved((c) => ({ ...c, [row.name_key]: value }));
      toast({ title: "✅ Nome de match criado", description: value });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Itens fora do catálogo" value={String(totals.count)} accent="warning" />
        <SummaryCard label="GMV envolvido" value={formatBRL(totals.gmv)} />
        <SummaryCard label="Com nome de match" value={`${totals.named} / ${totals.count}`} accent="success" />
        <SummaryCard label="Classificados (cat/subcat)" value={`${totals.classified} / ${totals.count}`} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <Input
            placeholder="Nome do item na proposta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block">Ordenar</label>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as any)}
            className="h-8 text-sm border border-border rounded-md bg-background px-2"
          >
            <option value="gmv">GMV</option>
            <option value="occurrences">Ocorrências</option>
            <option value="name">A-Z</option>
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <Sparkles className={cn("mr-2 h-3.5 w-3.5", loading && "animate-pulse")} />
          Recarregar
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Item na proposta (CRM)</th>
                <th className="text-right px-3 py-2">Ocorr.</th>
                <th className="text-right px-3 py-2">GMV</th>
                <th className="text-left px-3 py-2">Sugestão</th>
                <th className="text-left px-3 py-2">Selecionar do catálogo</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-left px-3 py-2">Subcategoria</th>
                <th className="text-left px-3 py-2">Ou criar nome de match</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const pick = picked[r.name_key];
                const sug = suggest(r.sample_name, variations);
                const done = resolved[r.name_key];
                const catValue = cats[r.name_key] ?? r.categoria ?? pick?.parent_category ?? "";
                const subValue = subs[r.name_key] ?? r.subcategoria ?? pick?.parent_subcategory ?? "";
                return (
                  <tr key={r.name_key} className="border-t hover:bg-muted/30 align-top">
                    <td className="px-3 py-2 max-w-[260px]">
                      <div className="font-medium truncate">{r.sample_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {[r.sample_code, r.sample_sku].filter(Boolean).join(" · ") || "sem código"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(r.occurrences).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatBRL(Number(r.gmv))}</td>
                    <td className="px-3 py-2 text-xs max-w-[180px]">
                      {sug ? (
                        <button
                          type="button"
                          className="text-left text-primary hover:underline"
                          onClick={() => setPicked((c) => ({ ...c, [r.name_key]: sug.v }))}
                        >
                          <Wand2 className="inline h-3 w-3 mr-1" />
                          <span className="truncate">{sug.v.parent_name || sug.v.sku}</span>
                          <span className="text-muted-foreground"> ({Math.round(sug.score * 100)}%)</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <VariationPicker
                          variations={variations}
                          onSelect={(v) => setPicked((c) => ({ ...c, [r.name_key]: v }))}
                          current={pick ? pick.parent_name || pick.sku : null}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={!pick || savingKey === r.name_key}
                          onClick={() => pick && void handleLinkCatalog(r, pick)}
                        >
                          <Save className="mr-1 h-3.5 w-3.5" />
                          Vincular
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        list="offcat-categories"
                        value={catValue}
                        placeholder="Categoria..."
                        onChange={(e) => setCats((c) => ({ ...c, [r.name_key]: e.target.value }))}
                        className="h-8 text-xs min-w-[150px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        list={`offcat-subs-${r.name_key}`}
                        value={subValue}
                        placeholder="Subcategoria..."
                        onChange={(e) => setSubs((c) => ({ ...c, [r.name_key]: e.target.value }))}
                        className="h-8 text-xs min-w-[150px]"
                      />
                      <datalist id={`offcat-subs-${r.name_key}`}>
                        {subOptionsFor(catValue).map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={names[r.name_key] ?? r.nome_canonico ?? ""}
                          placeholder={r.sample_name}
                          onChange={(e) => setNames((c) => ({ ...c, [r.name_key]: e.target.value }))}
                          className="h-8 text-xs min-w-[180px]"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={savingKey === r.name_key || !(names[r.name_key] ?? r.nome_canonico ?? "").trim()}
                          onClick={() => void handleCreateName(r)}
                        >
                          Criar
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {done ? (
                        <Badge className="text-[10px] bg-emerald-600">{done}</Badge>
                      ) : r.nome_canonico ? (
                        <Badge variant="secondary" className="text-[10px]">Nome definido</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Fora do catálogo
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {offCatalog.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    {loading ? "Carregando..." : "Nenhum item fora do catálogo 🎉"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <datalist id="offcat-categories">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {visibleCount < offCatalog.length && (
          <div className="flex items-center justify-center gap-3 border-t p-3 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Mostrando {visibleRows.length} de {offCatalog.length}
            </span>
            <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + 200)}>
              Carregar mais 200
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "border rounded-md p-3 bg-card",
        accent === "success" && "border-emerald-500/40 bg-emerald-500/5",
        accent === "warning" && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}
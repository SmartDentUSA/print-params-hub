import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown, Package, Save, Search, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useSkuMappingInbox,
  type CatalogVariationOption,
  type SkuInboxRow,
} from "@/hooks/useSkuMappingInbox";
import { KitComponentsDialog } from "./KitComponentsDialog";

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

/** Sugestão naive por sobreposição de tokens com o catálogo. */
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
  currentSku,
}: {
  variations: CatalogVariationOption[];
  onSelect: (v: CatalogVariationOption) => void;
  currentSku: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return variations.slice(0, 40);
    return variations
      .filter((v) =>
        [v.parent_name, v.presentation, v.sku, v.color, v.parent_category]
          .filter(Boolean)
          .some((f) => (f as string).toLowerCase().includes(s)),
      )
      .slice(0, 40);
  }, [variations, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="justify-between h-8 text-xs font-normal min-w-[180px]">
          <span className="truncate">{currentSku || "Selecionar variação..."}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, SKU..."
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
                <Check className={cn("h-3 w-3", currentSku === v.sku ? "opacity-100" : "opacity-0")} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.parent_name || v.presentation || v.sku}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {[v.sku, v.presentation, v.color].filter(Boolean).join(" · ")}
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

export function SkuMappingTab() {
  const { rows, variations, loading, load, saveMapping, saveCanonicalName } = useSkuMappingInbox();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "mapped" | "kits" | "off_catalog" | "all">("pending");
  const [sourceFilter, setSourceFilter] = useState<"all" | "deal_items" | "loja_integrada">("all");
  const [orderBy, setOrderBy] = useState<"gmv" | "occurrences" | "name">("gmv");
  const [pendingMappings, setPendingMappings] = useState<Record<string, CatalogVariationOption>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [lastSavedKey, setLastSavedKey] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(100);
  const [names, setNames] = useState<Record<string, string>>({});
  const [cats, setCats] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const [kitDialog, setKitDialog] = useState<{ open: boolean; aliasId: number | null; name: string }>({
    open: false,
    aliasId: null,
    name: "",
  });
  const { toast } = useToast();

  const offCatalogMode = statusFilter === "off_catalog";

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

  // Impressões digitais do catálogo (nomes + SKUs) para detectar "fora do catálogo".
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

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.sample_name?.toLowerCase().includes(s) ||
          r.sample_code?.toLowerCase().includes(s) ||
          r.sample_sku?.toLowerCase().includes(s) ||
          r.nome_canonico?.toLowerCase().includes(s),
      );
    }
    if (sourceFilter !== "all") {
      list = list.filter((r) => r.sources?.includes(sourceFilter));
    }
    if (statusFilter === "pending") {
      list = list.filter((r) => !r.alias_id || !r.sku_interno || r.name_key === lastSavedKey);
    }
    else if (statusFilter === "mapped") list = list.filter((r) => !!r.sku_interno && !r.is_kit);
    else if (statusFilter === "kits") list = list.filter((r) => r.is_kit);
    else if (statusFilter === "off_catalog") {
      list = list.filter((r) => {
        if (!r.sources?.includes("deal_items")) return false; // apenas propostas do CRM
        if (r.sku_interno) return false; // já mapeado a um SKU do catálogo
        if (r.is_kit) return false; // kits têm fluxo próprio
        if (catalogIndex.has(norm(r.sample_name))) return false;
        if (r.sample_sku && catalogIndex.has(norm(r.sample_sku))) return false;
        return true;
      });
    }

    list.sort((a, b) => {
      if (orderBy === "gmv") return Number(b.gmv) - Number(a.gmv);
      if (orderBy === "occurrences") return Number(b.occurrences) - Number(a.occurrences);
      return (a.sample_name || "").localeCompare(b.sample_name || "");
    });
    return list;
  }, [rows, search, statusFilter, sourceFilter, orderBy, lastSavedKey, catalogIndex]);

  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(100);
  }, [search, statusFilter, sourceFilter, orderBy]);

  const totals = useMemo(() => {
    const mapped = rows.filter((r) => !!r.sku_interno).length;
    const kits = rows.filter((r) => r.is_kit).length;
    const gmvCovered = rows
      .filter((r) => !!r.sku_interno)
      .reduce((s, r) => s + Number(r.gmv || 0), 0);
    const gmvTotal = rows.reduce((s, r) => s + Number(r.gmv || 0), 0);
    return { mapped, kits, total: rows.length, gmvCovered, gmvTotal };
  }, [rows]);

  const offTotals = useMemo(() => {
    if (!offCatalogMode) return null;
    return {
      count: filtered.length,
      gmv: filtered.reduce((s, r) => s + Number(r.gmv || 0), 0),
      named: filtered.filter((r) => !!r.nome_canonico || resolved[r.name_key]).length,
      classified: filtered.filter(
        (r) => !!(cats[r.name_key] ?? r.categoria) && !!(subs[r.name_key] ?? r.subcategoria),
      ).length,
    };
  }, [offCatalogMode, filtered, resolved, cats, subs]);

  const handleMap = async (row: SkuInboxRow, variation: CatalogVariationOption) => {
    setSavingKey(row.name_key);
    toast({ title: "Salvando SKU...", description: variation.sku || variation.parent_name || "" });
    try {
      await saveMapping(row, variation, false);
      setLastSavedKey(row.name_key);
      if (offCatalogMode) {
        setCats((c) => ({ ...c, [row.name_key]: variation.parent_category || c[row.name_key] || "" }));
        setSubs((c) => ({ ...c, [row.name_key]: variation.parent_subcategory || c[row.name_key] || "" }));
        setResolved((c) => ({ ...c, [row.name_key]: variation.sku || variation.parent_name || "vinculado" }));
      }
      setPendingMappings((current) => {
        const next = { ...current };
        delete next[row.name_key];
        return next;
      });
      toast({ title: "✅ SKU salvo no banco", description: variation.sku || variation.parent_name || "" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleKit = async (row: SkuInboxRow, becomeKit: boolean) => {
    try {
      const aliasId = await saveMapping(row, null, becomeKit);
      if (becomeKit) {
        setKitDialog({ open: true, aliasId, name: row.sample_name });
      } else {
        toast({ title: "Kit desmarcado" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
      {/* Summary */}
      {offCatalogMode && offTotals ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Itens fora do catálogo" value={String(offTotals.count)} accent="warning" />
          <SummaryCard label="GMV envolvido" value={formatBRL(offTotals.gmv)} />
          <SummaryCard label="Com nome de match" value={`${offTotals.named} / ${offTotals.count}`} accent="success" />
          <SummaryCard label="Classificados (cat/subcat)" value={`${offTotals.classified} / ${offTotals.count}`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Itens brutos" value={String(totals.total)} />
          <SummaryCard label="Mapeados" value={`${totals.mapped} / ${totals.total}`} accent="success" />
          <SummaryCard label="Kits configurados" value={String(totals.kits)} accent="info" />
          <SummaryCard label="GMV coberto" value={`${formatBRL(totals.gmvCovered)} / ${formatBRL(totals.gmvTotal)}`} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <Input
            placeholder="Nome, código ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <SelectField
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as any)}
          options={[
            { value: "pending", label: "Não mapeados" },
            { value: "mapped", label: "Mapeados" },
            { value: "kits", label: "Kits" },
            { value: "off_catalog", label: "Fora do catálogo" },
            { value: "all", label: "Todos" },
          ]}
        />
        <SelectField
          label="Origem"
          value={sourceFilter}
          onChange={(v) => setSourceFilter(v as any)}
          options={[
            { value: "all", label: "Todos" },
            { value: "deal_items", label: "Propostas CRM" },
            { value: "loja_integrada", label: "Loja Integrada" },
          ]}
        />
        <SelectField
          label="Ordenar"
          value={orderBy}
          onChange={(v) => setOrderBy(v as any)}
          options={[
            { value: "gmv", label: "GMV" },
            { value: "occurrences", label: "Ocorrências" },
            { value: "name", label: "A-Z" },
          ]}
        />
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <Sparkles className={cn("mr-2 h-3.5 w-3.5", loading && "animate-pulse")} />
          Recarregar
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Nome bruto</th>
                <th className="text-left px-3 py-2">Cód.</th>
                <th className="text-right px-3 py-2">Ocorr.</th>
                <th className="text-right px-3 py-2">GMV</th>
                {offCatalogMode ? (
                  <th className="text-left px-3 py-2">Sugestão</th>
                ) : (
                  <th className="text-left px-3 py-2">Tipo</th>
                )}
                <th className="text-left px-3 py-2">Variação / Componentes</th>
                {offCatalogMode && <th className="text-left px-3 py-2">Categoria</th>}
                {offCatalogMode && <th className="text-left px-3 py-2">Subcategoria</th>}
                {offCatalogMode && <th className="text-left px-3 py-2">Ou criar nome de match</th>}
                <th className="text-left px-3 py-2">SKU final</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const pending = pendingMappings[r.name_key];
                const sug = offCatalogMode ? suggest(r.sample_name, variations) : null;
                const catValue = cats[r.name_key] ?? r.categoria ?? pending?.parent_category ?? "";
                const subValue = subs[r.name_key] ?? r.subcategoria ?? pending?.parent_subcategory ?? "";
                return (
                <tr key={r.name_key} className={cn("border-t hover:bg-muted/30", offCatalogMode && "align-top")}>
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="font-medium truncate">{r.sample_name}</div>
                    <div className="text-[10px] text-muted-foreground">{r.sources}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.sku_interno ? (
                      <span className="font-mono font-semibold text-emerald-600">{r.sku_interno}</span>
                    ) : (
                      <span className="text-muted-foreground">{r.sample_code || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.occurrences).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatBRL(Number(r.gmv))}</td>
                  {offCatalogMode ? (
                    <td className="px-3 py-2 text-xs max-w-[180px]">
                      {sug ? (
                        <button
                          type="button"
                          className="text-left text-primary hover:underline"
                          onClick={() => setPendingMappings((c) => ({ ...c, [r.name_key]: sug.v }))}
                        >
                          <Wand2 className="inline h-3 w-3 mr-1" />
                          <span className="truncate">{sug.v.parent_name || sug.v.sku}</span>
                          <span className="text-muted-foreground"> ({Math.round(sug.score * 100)}%)</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ) : (
                    <td className="px-3 py-2">
                      <select
                        value={r.is_kit ? "kit" : "single"}
                        onChange={(e) => handleToggleKit(r, e.target.value === "kit")}
                        className="h-7 text-xs border border-border rounded bg-background px-1"
                      >
                        <option value="single">Único</option>
                        <option value="kit">Kit</option>
                      </select>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {r.is_kit ? (
                      <Button
                          type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() =>
                          setKitDialog({ open: true, aliasId: r.alias_id!, name: r.sample_name })
                        }
                      >
                        <Package className="h-3.5 w-3.5 mr-1" /> Editar componentes
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <VariationPicker
                          variations={variations}
                          onSelect={(v) => setPendingMappings((current) => ({ ...current, [r.name_key]: v }))}
                          currentSku={pending?.sku || pending?.parent_name || r.sku_interno}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={!pending || savingKey === r.name_key}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (pending) void handleMap(r, pending);
                          }}
                        >
                          <Save className="mr-1 h-3.5 w-3.5" />
                          {savingKey === r.name_key ? "Salvando..." : offCatalogMode ? "Vincular" : "Salvar"}
                        </Button>
                      </div>
                    )}
                  </td>
                  {offCatalogMode && (
                    <td className="px-3 py-2">
                      <Input
                        list="skumap-categories"
                        value={catValue}
                        placeholder="Categoria..."
                        onChange={(e) => setCats((c) => ({ ...c, [r.name_key]: e.target.value }))}
                        className="h-8 text-xs min-w-[150px]"
                      />
                    </td>
                  )}
                  {offCatalogMode && (
                    <td className="px-3 py-2">
                      <Input
                        list={`skumap-subs-${r.name_key}`}
                        value={subValue}
                        placeholder="Subcategoria..."
                        onChange={(e) => setSubs((c) => ({ ...c, [r.name_key]: e.target.value }))}
                        className="h-8 text-xs min-w-[150px]"
                      />
                      <datalist id={`skumap-subs-${r.name_key}`}>
                        {subOptionsFor(catValue).map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </td>
                  )}
                  {offCatalogMode && (
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
                  )}
                  <td className="px-3 py-2">
                    {resolved[r.name_key] ? (
                      <Badge className="text-[10px] bg-emerald-600">{resolved[r.name_key]}</Badge>
                    ) : r.is_kit ? (
                      <Badge variant="secondary" className="text-[10px]">🧩 KIT</Badge>
                    ) : r.sku_interno ? (
                      <Badge variant="default" className="text-[10px] bg-emerald-600">
                        {r.sku_interno}
                      </Badge>
                    ) : r.nome_canonico ? (
                      <Badge variant="secondary" className="text-[10px]">Nome definido</Badge>
                    ) : offCatalogMode ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Fora do catálogo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Pendente</Badge>
                    )}
                  </td>
                </tr>
              )})}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={offCatalogMode ? 10 : 7} className="text-center py-8 text-muted-foreground text-sm">
                    {loading ? "Carregando..." : "Nenhum item nesse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {offCatalogMode && (
            <datalist id="skumap-categories">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
        </div>
        {visibleCount < filtered.length && (
          <div className="flex items-center justify-center gap-3 border-t p-3 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Mostrando {visibleRows.length} de {filtered.length}
            </span>
            <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + 200)}>
              Carregar mais 200
            </Button>
          </div>
        )}
      </div>

      <KitComponentsDialog
        open={kitDialog.open}
        onOpenChange={(open) => setKitDialog((s) => ({ ...s, open }))}
        aliasId={kitDialog.aliasId}
        kitName={kitDialog.name}
        variations={variations}
      />
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
  accent?: "success" | "info" | "warning";
}) {
  return (
    <div
      className={cn(
        "border rounded-md p-3 bg-card",
        accent === "success" && "border-emerald-500/40 bg-emerald-500/5",
        accent === "info" && "border-blue-500/40 bg-blue-500/5",
        accent === "warning" && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm border border-border rounded-md bg-background px-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
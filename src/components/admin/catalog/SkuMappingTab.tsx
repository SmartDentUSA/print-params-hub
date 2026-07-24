import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown, Package, Save, Search, Sparkles, X } from "lucide-react";
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
  const { rows, variations, loading, load, saveMapping } = useSkuMappingInbox();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "mapped" | "kits" | "all">("pending");
  const [sourceFilter, setSourceFilter] = useState<"all" | "deal_items" | "loja_integrada">("all");
  const [orderBy, setOrderBy] = useState<"gmv" | "occurrences" | "name">("gmv");
  const [pendingMappings, setPendingMappings] = useState<Record<string, CatalogVariationOption>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [lastSavedKey, setLastSavedKey] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(100);

  const [kitDialog, setKitDialog] = useState<{ open: boolean; aliasId: number | null; name: string }>({
    open: false,
    aliasId: null,
    name: "",
  });
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.sample_name?.toLowerCase().includes(s) ||
          r.sample_code?.toLowerCase().includes(s) ||
          r.sample_sku?.toLowerCase().includes(s),
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

    list.sort((a, b) => {
      if (orderBy === "gmv") return Number(b.gmv) - Number(a.gmv);
      if (orderBy === "occurrences") return Number(b.occurrences) - Number(a.occurrences);
      return (a.sample_name || "").localeCompare(b.sample_name || "");
    });
    return list;
  }, [rows, search, statusFilter, sourceFilter, orderBy, lastSavedKey]);

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

  const handleMap = async (row: SkuInboxRow, variation: CatalogVariationOption) => {
    setSavingKey(row.name_key);
    toast({ title: "Salvando SKU...", description: variation.sku || variation.parent_name || "" });
    try {
      await saveMapping(row, variation, false);
      setLastSavedKey(row.name_key);
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

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Itens brutos" value={String(totals.total)} />
        <SummaryCard label="Mapeados" value={`${totals.mapped} / ${totals.total}`} accent="success" />
        <SummaryCard label="Kits configurados" value={String(totals.kits)} accent="info" />
        <SummaryCard label="GMV coberto" value={`${formatBRL(totals.gmvCovered)} / ${formatBRL(totals.gmvTotal)}`} />
      </div>

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
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Variação / Componentes</th>
                <th className="text-left px-3 py-2">SKU final</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const pending = pendingMappings[r.name_key];
                return (
                <tr key={r.name_key} className="border-t hover:bg-muted/30">
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
                          {savingKey === r.name_key ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.is_kit ? (
                      <Badge variant="secondary" className="text-[10px]">🧩 KIT</Badge>
                    ) : r.sku_interno ? (
                      <Badge variant="default" className="text-[10px] bg-emerald-600">
                        {r.sku_interno}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Pendente</Badge>
                    )}
                  </td>
                </tr>
              )})}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    {loading ? "Carregando..." : "Nenhum item nesse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
  accent?: "success" | "info";
}) {
  return (
    <div
      className={cn(
        "border rounded-md p-3 bg-card",
        accent === "success" && "border-emerald-500/40 bg-emerald-500/5",
        accent === "info" && "border-blue-500/40 bg-blue-500/5",
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
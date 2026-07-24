import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Trash2, Plus, Save, Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useKitComponents } from "@/hooks/useKitComponents";
import type { CatalogVariationOption } from "@/hooks/useSkuMappingInbox";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  aliasId: number | null;
  kitName: string;
  variations: CatalogVariationOption[];
}

export function KitComponentsDialog({ open, onOpenChange, aliasId, kitName, variations }: Props) {
  const { components, loading, addComponent, updateQuantity, removeComponent } = useKitComponents(aliasId);
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [selected, setSelected] = useState<CatalogVariationOption | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return variations.slice(0, 60);
    return variations
      .filter((v) =>
        [v.parent_name, v.presentation, v.sku, v.color, v.parent_category]
          .filter(Boolean)
          .some((f) => (f as string).toLowerCase().includes(s)),
      )
      .slice(0, 60);
  }, [variations, search]);

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await addComponent(selected, qty || 1);
      toast({ title: "Componente salvo", description: selected.parent_name || selected.sku || "" });
      setSearch("");
      setSelected(null);
      setQty(1);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🧩 Componentes do Kit
            <Badge variant="outline">{kitName}</Badge>
          </DialogTitle>
        </DialogHeader>

        {!aliasId ? (
          <p className="text-sm text-muted-foreground py-6">
            Salve o mapeamento como “Kit” primeiro para configurar componentes.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Componentes atuais */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Componentes ({components.length})</div>
              {loading ? (
                <div className="text-xs text-muted-foreground">Carregando...</div>
              ) : components.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nenhum componente ainda.</div>
              ) : (
                <ScrollArea className="h-[340px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {components.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 rounded border bg-card text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {c.parent_name || c.variation_presentation || c.variation_sku}
                          </div>
                          <div className="text-muted-foreground truncate">
                            {[c.variation_presentation, c.variation_sku].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={c.quantity}
                          onChange={(e) => updateQuantity(c.id, Number(e.target.value))}
                          className="w-16 h-7 text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeComponent(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Buscador para adicionar */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Adicionar variação do catálogo</div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, SKU, apresentação..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-7 text-xs"
                  />
                  {search && (
                    <X
                      className="absolute right-2 top-2.5 h-3.5 w-3.5 cursor-pointer text-muted-foreground"
                      onClick={() => setSearch("")}
                    />
                  )}
                </div>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-16 h-8 text-xs"
                  title="Quantidade"
                />
              </div>
              {selected && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{selected.parent_name || selected.presentation || selected.sku}</div>
                    <div className="truncate text-muted-foreground">{selected.sku || "Produto sem SKU granular"}</div>
                  </div>
                  <Button size="sm" className="h-8 shrink-0 text-xs" onClick={handleAdd} disabled={saving}>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    {saving ? "Salvando..." : "Salvar componente"}
                  </Button>
                </div>
              )}
              <ScrollArea className="h-[290px] border rounded-md">
                <div className="p-1">
                  {filtered.map((v) => (
                    <Button
                      type="button"
                      variant="ghost"
                      key={v.id}
                      onClick={() => setSelected(v)}
                      className={cn(
                        "h-auto w-full justify-start gap-2 rounded-sm px-2 py-1.5 text-xs text-left",
                        selected?.id === v.id && "bg-accent",
                      )}
                    >
                      {selected?.id === v.id ? <Check className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{v.parent_name || v.presentation || v.sku}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {[v.sku, v.presentation, v.color].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </Button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Nenhum resultado
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
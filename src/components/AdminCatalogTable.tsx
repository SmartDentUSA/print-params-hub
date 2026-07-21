import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Edit,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  FileText,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct } from "@/hooks/useCatalogCRUD";
import {
  useCatalogVariationsFor,
  makePlaceholderVariation,
  isPlaceholderVariation,
  type CatalogVariation,
} from "@/hooks/useCatalogVariations";
import { useCatalogDocCounts } from "@/hooks/useCatalogDocCounts";
import {
  PRESENTATION_OPTIONS,
  categoryRank,
} from "@/components/smartops/distributors/types";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  products: CatalogProduct[];
  onEditCore: (p: CatalogProduct) => void;
  onDeleteCore: (id: string) => void;
  onToggleVisibility: (id: string, current: boolean | undefined) => void;
  onToggleActive: (id: string, current: boolean | undefined) => void;
}

function isResinRow(p: CatalogProduct): boolean {
  const cat = (p.product_category || p.category || "").toLowerCase();
  return cat.includes("resina");
}

/** Presets físicos por gramatura de resina (embalagem padrão). */
const RESIN_GRS_PRESETS: Record<string, { weight_kg: number; dimensions_cm: string }> = {
  "250": { weight_kg: 0.33, dimensions_cm: "16.0 x 8.0 x 8.0" },
  "500": { weight_kg: 0.61, dimensions_cm: "19.5 x 8.5 x 8.5" },
  "1000": { weight_kg: 1.13, dimensions_cm: "24.5 x 9.5 x 9.5" },
};

function firstWorkflowStage(p: CatalogProduct): string | null {
  const stages = (p as any).workflow_stages;
  if (Array.isArray(stages) && stages.length > 0) {
    const s = stages[0];
    return String(s?.name || s?.label || s?.stage || "") || null;
  }
  return null;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Não foi possível copiar"),
  );
}

/** Célula de input com autosave onBlur (só grava se mudou). */
function CellInput({
  value,
  placeholder,
  type = "text",
  className = "",
  onCommit,
  disabled,
}: {
  value: string | number | null;
  placeholder?: string;
  type?: "text" | "number";
  className?: string;
  onCommit: (next: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const initial = value == null ? "" : String(value);
  const [local, setLocal] = useState(initial);
  if (local !== initial && document.activeElement?.tagName !== "INPUT") {
    // sync when parent value changes and this input is not focused
    setLocal(initial);
  }
  return (
    <Input
      value={local}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={async () => {
        if (local === initial) return;
        try {
          await onCommit(local);
        } catch (e: any) {
          toast.error(e?.message || "Erro ao salvar");
          setLocal(initial);
        }
      }}
      className={`h-8 text-xs ${className}`}
    />
  );
}

export function AdminCatalogTable({
  products,
  onEditCore,
  onDeleteCore,
  onToggleVisibility,
  onToggleActive,
}: Props) {
  const productIds = useMemo(
    () => products.map((p) => p.id!).filter(Boolean),
    [products],
  );
  const { variationsByProduct, upsertField, addVariation, removeVariation, loadAll } =
    useCatalogVariationsFor(productIds);
  const docCounts = useCatalogDocCounts(
    products.map((p) => ({ id: p.id!, slug: p.slug, name: p.name })),
  );

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const ca = (a.product_category || "~~sem~~").toString();
      const cb = (b.product_category || "~~sem~~").toString();
      if (ca !== cb) return ca.localeCompare(cb, "pt", { numeric: true });
      const sa = ((a as any).product_subcategory || "").toString();
      const sb = ((b as any).product_subcategory || "").toString();
      if (sa !== sb) return sa.localeCompare(sb, "pt", { numeric: true });
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [products]);

  /**
   * Grava um campo em uma variação. Se a linha for placeholder, cria a
   * variação real primeiro e depois aplica o patch — tudo sem tocar
   * em system_a_catalog ou resins.
   */
  const commitVariationField = async (
    productId: string,
    variation: CatalogVariation,
    patch: Partial<CatalogVariation>,
  ) => {
    if (isPlaceholderVariation(variation)) {
      const created = await addVariation(productId);
      if (created) {
        await upsertField(created.id, patch);
      }
    } else {
      await upsertField(variation.id, patch);
    }
  };

  const commitCoreManufacturer = async (
    product: CatalogProduct,
    value: string,
  ) => {
    if (isResinRow(product)) return; // read-only for resin mirror rows
    const next = { ...(product.extra_data || {}), manufacturer: value || null };
    const { error } = await (supabase as any)
      .from("system_a_catalog")
      .update({ extra_data: next })
      .eq("id", product.id!);
    if (error) throw error;
    (product as any).extra_data = next;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-md border overflow-x-auto">
        <Table className="text-xs min-w-[1900px] [&_th]:whitespace-nowrap [&_td]:align-middle">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-14 text-center">Status</TableHead>
              <TableHead className="w-32">SKU / Fabricante</TableHead>
              <TableHead className="min-w-[260px]">Produto</TableHead>
              <TableHead className="w-24">Variação</TableHead>
              <TableHead className="w-20">Pres</TableHead>
              <TableHead className="w-24">Cor</TableHead>
              <TableHead className="w-24">NCM/HS</TableHead>
              <TableHead className="w-28">GTIN/EAN</TableHead>
              <TableHead className="w-20">Peso (kg)</TableHead>
              <TableHead className="w-28">Dim (cm)</TableHead>
              <TableHead className="w-32">BRL</TableHead>
              <TableHead className="w-32">USD</TableHead>
              <TableHead className="w-32">EUR</TableHead>
              <TableHead className="w-20 text-center">Status</TableHead>
              <TableHead className="w-24 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                let lastCat = "__init__";
                let lastSub = "__init__";
                const rows: JSX.Element[] = [];
                sortedProducts.forEach((product) => {
                  const cat = product.product_category || "Sem classificação";
                  const sub = (product as any).product_subcategory || "—";
                  if (cat !== lastCat) {
                    rows.push(
                      <TableRow key={`cat-${cat}`} className="bg-primary/10 hover:bg-primary/10">
                        <TableCell colSpan={15} className="py-2 font-bold text-sm text-primary uppercase tracking-wide">
                          {cat}
                        </TableCell>
                      </TableRow>
                    );
                    lastCat = cat;
                    lastSub = "__init__";
                  }
                  if (sub !== lastSub) {
                    rows.push(
                      <TableRow key={`sub-${cat}-${sub}`} className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={15} className="py-1.5 pl-6 italic text-xs text-muted-foreground font-semibold">
                          {sub}
                        </TableCell>
                      </TableRow>
                    );
                    lastSub = sub;
                  }
                const list =
                  variationsByProduct[product.id!] ||
                  [makePlaceholderVariation(product.id!)];
                const resin = isResinRow(product);
                const manufacturer =
                  ((product as any).extra_data?.manufacturer as string) ||
                  ((product as any).extra_data?.brand as string) ||
                  "";
                const lojaId =
                  ((product as any).extra_data?.loja_integrada_id as string) ||
                  ((product as any).extra_data?.loja_id as string) ||
                  "";
                const stage = firstWorkflowStage(product);
                const dc = docCounts[product.id!];

                list.forEach((v, idx) => rows.push(
                  <TableRow key={`${product.id}-${v.id}`}>
                    {idx === 0 ? (
                      <>
                        <TableCell rowSpan={list.length} className="align-top">
                          <Switch
                            checked={!!product.active}
                            onCheckedChange={() => onToggleActive(product.id!, product.active)}
                          />
                        </TableCell>
                      </>
                    ) : null}

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <CellInput
                          value={v.sku}
                          placeholder="SKU"
                          onCommit={(val) => commitVariationField(product.id!, v, { sku: val || null })}
                        />
                        {idx === 0 && (
                          <CellInput
                            value={manufacturer}
                            placeholder={resin ? "(via Resinas)" : "Fabricante"}
                            disabled={resin}
                            onCommit={(val) => commitCoreManufacturer(product, val)}
                          />
                        )}
                      </div>
                    </TableCell>

                     {idx === 0 ? (
                       <>
                         <TableCell rowSpan={list.length} className="align-top">
                           <div className="flex flex-col gap-1.5">
                             <div className="flex flex-wrap items-center gap-1">
                               {stage ? (
                                 <Badge variant="outline" className="text-[10px]">{stage}</Badge>
                               ) : null}
                               {product.product_category ? (
                                 <Badge variant="outline" className="text-[10px] w-fit">
                                   {product.product_category}
                                 </Badge>
                               ) : null}
                             </div>
                             {(product as any).product_subcategory ? (
                               <span className="text-muted-foreground text-[11px] leading-tight">
                                 {(product as any).product_subcategory}
                               </span>
                             ) : null}
                           <div className="flex items-center gap-2">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                loading="lazy"
                                className="w-8 h-8 object-contain rounded border bg-muted flex-shrink-0"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center flex-shrink-0">
                                <ShoppingCart className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{product.name}</div>
                              {product.slug && (
                                <div className="text-[10px] text-muted-foreground font-mono truncate">/{product.slug}</div>
                              )}
                              {resin && (
                                <Badge variant="secondary" className="text-[9px] mt-1">Espelho · Resinas</Badge>
                              )}
                            </div>
                          </div>
                           </div>
                         </TableCell>
                      </>
                    ) : null}

                    <TableCell>
                      <CellInput
                        value={v.presentation_qty}
                        placeholder="ex: 250"
                        type="number"
                        onCommit={(val) => {
                          const cleaned = (val || "").replace(/[^\d.,]/g, "").replace(",", ".");
                          const patch: any = { presentation_qty: cleaned || null };
                          const preset = RESIN_GRS_PRESETS[cleaned];
                          const unit = (v.presentation || "").toLowerCase();
                          if (preset && (!v.presentation || unit === "grs" || unit === "g")) {
                            if (v.weight_kg == null) patch.weight_kg = preset.weight_kg;
                            if (!v.dimensions_cm) patch.dimensions_cm = preset.dimensions_cm;
                            if (!v.presentation) patch.presentation = "grs";
                          }
                          return commitVariationField(product.id!, v, patch);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={v.presentation || ""}
                        onValueChange={async (val) => {
                          try {
                            const patch: any = { presentation: val || null };
                            const preset = RESIN_GRS_PRESETS[v.presentation_qty || ""];
                            if (preset && (val === "grs" || val === "g")) {
                              if (v.weight_kg == null) patch.weight_kg = preset.weight_kg;
                              if (!v.dimensions_cm) patch.dimensions_cm = preset.dimensions_cm;
                            }
                            await commitVariationField(product.id!, v, patch);
                          } catch (e: any) {
                            toast.error(e?.message || "Erro ao salvar");
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESENTATION_OPTIONS.map((p) => (
                            <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {v.color && (
                          <span
                            className="inline-block w-3 h-3 rounded border"
                            style={{ backgroundColor: v.color }}
                            aria-hidden
                          />
                        )}
                        <CellInput
                          value={v.color}
                          placeholder="cor"
                          onCommit={(val) => commitVariationField(product.id!, v, { color: val || null })}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <CellInput
                        value={v.ncm_hs}
                        placeholder="NCM"
                        onCommit={(val) => commitVariationField(product.id!, v, { ncm_hs: val || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <CellInput
                        value={v.gtin_ean}
                        placeholder="GTIN/EAN"
                        onCommit={(val) => commitVariationField(product.id!, v, { gtin_ean: val || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <CellInput
                        value={v.weight_kg}
                        type="number"
                        placeholder="0.00"
                        onCommit={(val) => commitVariationField(product.id!, v, {
                          weight_kg: val ? Number(val) : null,
                        })}
                      />
                    </TableCell>
                    <TableCell>
                      <CellInput
                        value={v.dimensions_cm}
                        placeholder="LxAxP"
                        onCommit={(val) => commitVariationField(product.id!, v, { dimensions_cm: val || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <CellInput
                        value={v.price_brl}
                        type="number"
                        placeholder="0.00"
                        onCommit={(val) => commitVariationField(product.id!, v, {
                          price_brl: val ? Number(val) : null,
                        })}
                      />
                    </TableCell>
                    <TableCell>
                      <CellInput
                        value={v.price_usd}
                        type="number"
                        placeholder="0.00"
                        onCommit={(val) => commitVariationField(product.id!, v, {
                          price_usd: val ? Number(val) : null,
                        })}
                      />
                    </TableCell>
                    <TableCell>
                      <CellInput
                        value={v.price_eur}
                        type="number"
                        placeholder="0.00"
                        onCommit={(val) => commitVariationField(product.id!, v, {
                          price_eur: val ? Number(val) : null,
                        })}
                      />
                    </TableCell>

                    {idx === 0 ? (
                      <>
                        <TableCell rowSpan={list.length} className="align-top">
                          <div className="flex flex-col items-center gap-1.5">
                            <Checkbox
                              checked={!!product.visible_in_ui}
                              onCheckedChange={() => onToggleVisibility(product.id!, product.visible_in_ui)}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={dc && dc.total > 0 ? "default" : "secondary"} className="cursor-help">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {dc?.total ?? 0}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">
                                Catálogo: {dc?.catalog ?? 0} · Resinas: {dc?.resins ?? 0}
                              </TooltipContent>
                            </Tooltip>
                            <Badge variant={product.active ? "default" : "secondary"} className="text-[10px]">
                              {product.active ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant={product.approved ? "default" : "destructive"} className="text-[10px]">
                              {product.approved ? "Aprovado" : "Pendente"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell rowSpan={list.length} className="align-top">
                          <div className="flex flex-wrap items-center gap-1">
                            {resin ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => onEditCore(product)}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar em Resinas (core)</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => onEditCore(product)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={async () => {
                                    try {
                                      await addVariation(product.id!);
                                      toast.success("Variação adicionada");
                                    } catch (e: any) {
                                      toast.error(e?.message || "Erro");
                                    }
                                  }}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Adicionar variação</TooltipContent>
                            </Tooltip>
                            {!resin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 px-2">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      "{product.name}" será removido do catálogo, junto com suas variações e documentos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => onDeleteCore(product.id!)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <TableCell>
                        {!isPlaceholderVariation(v) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive"
                            onClick={async () => {
                              try {
                                await removeVariation(v.id);
                                toast.success("Variação removida");
                              } catch (e: any) {
                                toast.error(e?.message || "Erro");
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ));
                });
                return rows;
              })()
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
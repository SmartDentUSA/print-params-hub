import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Download, RefreshCw, Trash2, Plus, ImageOff, FileSpreadsheet, FileText, FileType, History, Save, RotateCcw, Eye, EyeOff, Layers } from "lucide-react";
import { toast } from "sonner";
import type { DealerPriceItem, DealerPriceList, Distributor, DealerSnapshot } from "./types";
import { recalcDealerPrice, recalcDiscount, formatMoney, PRESENTATION_OPTIONS, categoryRank } from "./types";
import { exportPriceTableXlsx, exportPriceTablePdf, exportPriceTableDocx } from "./DealerProposalExport";

/** Extrai NCM (compartilhado) + lista de variações {qty, gtin, unit} do technical_specs. */
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
  const variations = qtys.map((qty) => ({
    qty,
    gtin: gtinByQty.get(qty) || null,
    unit: unitFor(qty),
  }));
  return { ncm, variations };
}

const I18N: Record<string, Record<string, string>> = {
  pt: {
    distributor: "Distribuidor", selectPlaceholder: "Selecione um distribuidor…",
    importCatalog: "Importar catálogo", save: "Salvar", saved: "Salvo",
    snapshotPlaceholder: "Rótulo do snapshot (opcional)", saveSnapshot: "Salvar no histórico",
    history: "Histórico", generateProposal: "Gerar proposta →",
    currency: "Moeda", language: "Idioma", items: "Itens",
    tableTotal: "Preço tabela total", dealerTotal: "Preço dealer total", discount: "Desconto",
    historyTitle: "Histórico de cotações", noSnapshots: "Nenhuma cotação salva ainda. Use “Salvar no histórico” para versionar a tabela atual.",
    date: "Data", label: "Rótulo", totalDealer: "Total dealer", restore: "Restaurar",
    restoreConfirm: "Restaurar esta versão? A tabela atual será substituída (uma nova versão será salva automaticamente).",
    autoEdit: "Edição manual", autoImport: "Importação de catálogo", autoRemove: "Item removido",
    autoRecalc: "Recalculado do catálogo", autoRestore: "Restauração do histórico",
    loading: "Carregando…", selectPrompt: "Selecione um distribuidor para criar/editar sua tabela.",
    emptyTable: "Tabela vazia. Clique em", populateAll: "para popular todos os produtos ativos.",
    noCategory: "Sem categoria",
    hPhoto: "Foto", hCod: "COD", hProduct: "Produto", hPresQty: "Pres #", hPres: "Pres", hNcm: "NCM/HS", hGtin: "GTIN/EAN",
    hUnit: "Unid (×)", hTablePrice: "Preço tabela (Unit)", hDiscount: "% Desc.",
    hDealerUnit: "Preço dealer (Unit)", hDealerTotal: "Preço dealer",
    catDiscount: "% Desc. categoria", apply: "Aplicar",
    recalcFromCatalog: "Recalcular preços do catálogo",
    active: "Ativo", inactive: "Inativo", showInactive: "Mostrar inativos",
    deleteSnapshot: "Excluir", confirmDeleteSnapshot: "Excluir esta cotação do histórico? Esta ação não pode ser desfeita.",
    snapshotDeleted: "Cotação removida do histórico",
  },
  es: {
    distributor: "Distribuidor", selectPlaceholder: "Seleccione un distribuidor…",
    importCatalog: "Importar catálogo", save: "Guardar", saved: "Guardado",
    snapshotPlaceholder: "Etiqueta del snapshot (opcional)", saveSnapshot: "Guardar en historial",
    history: "Historial", generateProposal: "Generar propuesta →",
    currency: "Moneda", language: "Idioma", items: "Ítems",
    tableTotal: "Precio tabla total", dealerTotal: "Precio dealer total", discount: "Descuento",
    historyTitle: "Historial de cotizaciones", noSnapshots: "Ninguna cotización guardada aún. Use “Guardar en historial” para versionar la tabla actual.",
    date: "Fecha", label: "Etiqueta", totalDealer: "Total dealer", restore: "Restaurar",
    restoreConfirm: "¿Restaurar esta versión? La tabla actual será reemplazada (se guardará una nueva versión automáticamente).",
    autoEdit: "Edición manual", autoImport: "Importación de catálogo", autoRemove: "Ítem eliminado",
    autoRecalc: "Recalculado del catálogo", autoRestore: "Restauración del historial",
    loading: "Cargando…", selectPrompt: "Seleccione un distribuidor para crear/editar su tabla.",
    emptyTable: "Tabla vacía. Haga clic en", populateAll: "para cargar todos los productos activos.",
    noCategory: "Sin categoría",
    hPhoto: "Foto", hCod: "COD", hProduct: "Producto", hPresQty: "Pres #", hPres: "Pres", hNcm: "NCM/HS", hGtin: "GTIN/EAN",
    hUnit: "Unid (×)", hTablePrice: "Precio tabla (Unit)", hDiscount: "% Desc.",
    hDealerUnit: "Precio dealer (Unit)", hDealerTotal: "Precio dealer",
    catDiscount: "% Desc. categoría", apply: "Aplicar",
    recalcFromCatalog: "Recalcular precios del catálogo",
    active: "Activo", inactive: "Inactivo", showInactive: "Mostrar inactivos",
    deleteSnapshot: "Eliminar", confirmDeleteSnapshot: "¿Eliminar esta cotización del historial? Esta acción no se puede deshacer.",
    snapshotDeleted: "Cotización eliminada del historial",
  },
  en: {
    distributor: "Distributor", selectPlaceholder: "Select a distributor…",
    importCatalog: "Import catalog", save: "Save", saved: "Saved",
    snapshotPlaceholder: "Snapshot label (optional)", saveSnapshot: "Save to history",
    history: "History", generateProposal: "Generate proposal →",
    currency: "Currency", language: "Language", items: "Items",
    tableTotal: "List total", dealerTotal: "Dealer total", discount: "Discount",
    historyTitle: "Quote history", noSnapshots: "No quotes saved yet. Use “Save to history” to version the current table.",
    date: "Date", label: "Label", totalDealer: "Dealer total", restore: "Restore",
    restoreConfirm: "Restore this version? The current table will be replaced (a new version will be auto-saved).",
    autoEdit: "Manual edit", autoImport: "Catalog import", autoRemove: "Item removed",
    autoRecalc: "Recalculated from catalog", autoRestore: "Restored from history",
    loading: "Loading…", selectPrompt: "Select a distributor to create/edit its table.",
    emptyTable: "Empty table. Click", populateAll: "to load all active products.",
    noCategory: "Uncategorized",
    hPhoto: "Photo", hCod: "SKU", hProduct: "Product", hPresQty: "Pres #", hPres: "Pres", hNcm: "HS Code", hGtin: "GTIN/EAN",
    hUnit: "Qty (×)", hTablePrice: "List price (Unit)", hDiscount: "% Disc.",
    hDealerUnit: "Dealer price (Unit)", hDealerTotal: "Dealer price",
    catDiscount: "% Disc. category", apply: "Apply",
    recalcFromCatalog: "Recalculate prices from catalog",
    active: "Active", inactive: "Inactive", showInactive: "Show inactive",
    deleteSnapshot: "Delete", confirmDeleteSnapshot: "Delete this quote from history? This cannot be undone.",
    snapshotDeleted: "Quote removed from history",
  },
};

type Props = { distributors: Distributor[]; onGenerateProposal?: (list: DealerPriceList, items: DealerPriceItem[]) => void };

export function DealerPriceTable({ distributors, onGenerateProposal }: Props) {
  const [distributorId, setDistributorId] = useState<string>("");
  const [list, setList] = useState<DealerPriceList | null>(null);
  const [items, setItems] = useState<DealerPriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [snapshots, setSnapshots] = useState<DealerSnapshot[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [catDiscount, setCatDiscount] = useState<Record<string, string>>({});
  const [showInactive, setShowInactive] = useState(false);

  const distributor = distributors.find((d) => d.id === distributorId);
  const currency = list?.currency || distributor?.preferred_currency || "BRL";
  const lang = (list?.language || distributor?.language_preference || "pt").toLowerCase();
  const t = I18N[lang] || I18N.pt;
  const displayName = (it: DealerPriceItem) =>
    (lang === "es" && it.name_es) || (lang === "en" && it.name_en) || it.name || "";

  const loadOrCreate = async (distId: string) => {
    setLoading(true);
    const dist = distributors.find((d) => d.id === distId);
    let { data: lists } = await supabase
      .from("dealer_price_lists" as any)
      .select("*")
      .eq("distributor_id", distId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1);
    let l = (lists as any)?.[0];
    if (!l) {
      const { data: created, error } = await supabase
        .from("dealer_price_lists" as any)
        .insert({
          distributor_id: distId,
          name: "Tabela padrão",
          currency: dist?.preferred_currency || "BRL",
          language: dist?.language_preference || "pt",
        })
        .select("*")
        .single();
      if (error) { toast.error("Erro ao criar tabela: " + error.message); setLoading(false); return; }
      l = created;
    } else if (
      dist &&
      ((dist.preferred_currency && l.currency !== dist.preferred_currency) ||
        (dist.language_preference && l.language !== dist.language_preference))
    ) {
      // Sincroniza a tabela existente com as preferências atuais do distribuidor
      const { data: updated } = await supabase
        .from("dealer_price_lists" as any)
        .update({
          currency: dist.preferred_currency || l.currency,
          language: dist.language_preference || l.language,
        })
        .eq("id", l.id)
        .select("*")
        .single();
      if (updated) l = updated;
    }
    setList(l as DealerPriceList);
    const { data: rows } = await supabase
      .from("dealer_price_items" as any)
      .select("*")
      .eq("price_list_id", l.id)
      .order("category", { ascending: true })
      .order("subcategory", { ascending: true })
      .order("sort_order", { ascending: true });
    setItems(((rows as any) || []) as DealerPriceItem[]);
    setDirtyIds(new Set());
    // Carrega histórico de snapshots
    const { data: snaps } = await supabase
      .from("dealer_price_list_snapshots" as any)
      .select("id,distributor_id,price_list_id,label,currency,language,items,totals,created_at")
      .eq("distributor_id", distId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSnapshots(((snaps as any) || []) as DealerSnapshot[]);
    setLoading(false);
  };

  useEffect(() => {
    if (distributorId) loadOrCreate(distributorId);
    else { setList(null); setItems([]); }
  }, [distributorId]);

  const importCatalog = async () => {
    if (!list) return;
    setLoading(true);
    // Fonte: catalog_product_variations (canônica) + system_a_catalog (metadados do produto).
    // Cada variação vira uma linha na tabela de preço do distribuidor.
    const [prodRes, varRes] = await Promise.all([
      supabase
        .from("system_a_catalog" as any)
        .select("id,external_id,name,name_en,name_es,image_url,product_category,product_subcategory,description,price,price_usd,price_eur,presentation,quantity_multiplier,extra_data,active,approved")
        .eq("approved", true),
      supabase
        .from("catalog_product_variations" as any)
        .select("*"),
    ]);
    if (prodRes.error) { toast.error(prodRes.error.message); setLoading(false); return; }
    if (varRes.error) { toast.error(varRes.error.message); setLoading(false); return; }
    const productsById = new Map<string, any>(((prodRes.data as any) || []).map((p: any) => [p.id, p]));
    const allVars = (varRes.data as any) || [];
    const norm = (value: any) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const existingByKey = new Map<string, DealerPriceItem>(
      items
        .filter((i) => i.catalog_product_id)
        .map((i) => [`${i.catalog_product_id}::${norm(i.presentation_qty)}`, i] as const),
    );
    const cur = (list.currency || distributor?.preferred_currency || "BRL").toUpperCase();
    const presentationFor = (v: any, p: any): "Grs/Kg" | "Unit" | "Kit" => {
      const unit = String(v?.unidade || "").trim().toLowerCase();
      const qty = String(v?.presentation_qty || "").trim().toLowerCase();
      const productPresentation = String(p?.presentation || "").trim().toLowerCase();
      if (["g", "kg", "mg"].includes(unit) || /(?:^|\d)\s*(?:mg|g|kg)\b/i.test(qty)) return "Grs/Kg";
      if (/\b(?:kit|caixa|cx|pack|conjunto)\b/i.test(`${qty} ${productPresentation}`)) return "Kit";
      return "Unit";
    };
    const priceFor = (v: any, p: any): { value: number; fallback: boolean } => {
      const pick = cur === "USD" ? (v.price_usd ?? p?.price_usd) : cur === "EUR" ? (v.price_eur ?? p?.price_eur) : (v.price_brl ?? p?.price);
      const n = Number(pick);
      if (isFinite(n) && n > 0) return { value: n, fallback: false };
      const brl = Number(v.price_brl ?? p?.price) || 0;
      return { value: brl, fallback: cur !== "BRL" && brl > 0 };
    };
    let fallbackCount = 0;
    const toInsert: any[] = [];
    const toUpdate: Array<{ id: string; patch: any }> = [];
    let cursor = items.length;
    for (const v of allVars) {
      const p = productsById.get(v.catalog_product_id);
      if (!p) continue;
      const key = `${v.catalog_product_id}::${norm(v.presentation_qty)}`;
      const priced = priceFor(v, p);
      if (priced.fallback) fallbackCount++;
      const current = existingByKey.get(key);
      const catalogFields = {
        catalog_product_id: p.id,
        cod: p?.external_id || null,
        name: p.name,
        name_en: p.name_en,
        name_es: p.name_es,
        image_url: p.image_url,
        category: p.product_category,
        subcategory: p.product_subcategory,
        description: p.description,
        ncm_hs: v.ncm_hs ?? null,
        gtin_ean: v.gtin_ean ?? null,
        price_base: priced.value,
        presentation: presentationFor(v, p),
        quantity_multiplier: Number(p.quantity_multiplier ?? 1) || 1,
        presentation_qty: v.presentation_qty,
        unidade: v.unidade || "UN",
        is_active: true,
      };
      if (current) {
        toUpdate.push({
          id: current.id,
          patch: {
            ...catalogFields,
            price_dealer: recalcDealerPrice(priced.value, Number(current.discount_pct) || 0),
          },
        });
      } else {
        toInsert.push({
          price_list_id: list.id,
          ...catalogFields,
          discount_pct: 0,
          price_dealer: priced.value,
          sort_order: cursor++,
        });
      }
    }
    const updateResults = await Promise.all(
      toUpdate.map(({ id, patch }) =>
        supabase.from("dealer_price_items" as any).update(patch).eq("id", id),
      ),
    );
    const updateError = updateResults.find((result: any) => result.error)?.error;
    if (updateError) { toast.error(`Erro ao atualizar variações: ${updateError.message}`); setLoading(false); return; }
    let insErr: any = null;
    if (toInsert.length > 0) {
      const result = await supabase.from("dealer_price_items" as any).insert(toInsert);
      insErr = result.error;
    }
    if (insErr) { toast.error(`Erro ao importar variações: ${insErr.message}`); setLoading(false); return; }
    if (toInsert.length === 0 && toUpdate.length === 0) {
      toast.info("Nenhuma alteração do catálogo para importar.");
      setLoading(false);
      return;
    }
    toast.success(`${toInsert.length} novos e ${toUpdate.length} atualizados (${cur})`);
    if (fallbackCount > 0) toast.warning(`${fallbackCount} itens sem preço em ${cur} — usando BRL como fallback`);
    await loadOrCreate(distributorId);
    // captura snapshot pós-import com estado recém carregado
    const { data: rows } = await supabase.from("dealer_price_items" as any).select("*").eq("price_list_id", list.id);
    await autoSnapshot(`${t.autoImport} (+${toInsert.length}, ~${toUpdate.length})`, ((rows as any) || []) as DealerPriceItem[]);
  };

  const recalcFromCatalog = async () => {
    if (!list) return;
    await recalcAndPersist(list.currency || distributor?.preferred_currency || "BRL", { snapshotLabel: null });
  };

  /**
   * Sincroniza variações (GTIN, NCM, unidade de medida) a partir dos cards do catálogo.
   * Fonte: system_a_catalog.extra_data.system_a_live.technical_specs
   *   - Label "NCM" → ncm_hs (compartilhado por todas as variações)
   *   - Label "Variações disponíveis" → lista tipo "500g, 1kg"
   *   - Label "GTIN/EAN — {qty}" → gtin_ean por variação
   *   - Sufixo da variação (kg/g/ml/L) → unidade
   * Se um item ainda não estiver desdobrado por variação (presentation_qty vazio) e o
   * card tiver múltiplas variações, o item existente vira a 1ª variação e as demais
   * são inseridas como linhas irmãs.
   */
  const syncVariationsFromCatalog = async () => {
    if (!list || items.length === 0) return;
    const ids = Array.from(new Set(items.map((i) => i.catalog_product_id).filter(Boolean))) as string[];
    if (ids.length === 0) { toast.info("Nenhum item ligado ao catálogo."); return; }
    setSaving(true);
    const { data: cat, error } = await supabase
      .from("system_a_catalog" as any)
      .select("id,extra_data,ncm,gtin")
      .in("id", ids);
    if (error) { toast.error(error.message); setSaving(false); return; }
    const byId = new Map<string, any>(((cat as any) || []).map((p: any) => [p.id, p]));

    let rowsUpdated = 0;
    let rowsInserted = 0;
    const updateOps: Array<() => Promise<any>> = [];
    const insertPayload: any[] = [];
    const nextItems: DealerPriceItem[] = [];

    // agrupa itens por catálogo para saber se algum já cobre múltiplas variações
    const byCatalog = new Map<string, DealerPriceItem[]>();
    for (const it of items) {
      const key = it.catalog_product_id || `__local__${it.id}`;
      if (!byCatalog.has(key)) byCatalog.set(key, []);
      byCatalog.get(key)!.push(it);
    }

    for (const it of items) {
      const p = it.catalog_product_id ? byId.get(it.catalog_product_id) : null;
      const specs = (p?.extra_data?.system_a_live?.technical_specs ?? []) as Array<{ label: string; value: string }>;
      const parsed = parseSpecVariations(specs);
      // NCM: prefere technical_specs, cai para coluna direta
      const ncm = parsed.ncm || p?.ncm || it.ncm_hs || null;
      // Matching por presentation_qty (case-insensitive, sem espaços)
      const norm = (s: any) => String(s || "").toLowerCase().replace(/\s+/g, "");
      const currentQty = norm(it.presentation_qty);
      const match = parsed.variations.find((v) => norm(v.qty) === currentQty);
      const gtin = match?.gtin || (parsed.variations.length === 1 ? parsed.variations[0].gtin : null) || p?.gtin || it.gtin_ean || null;
      const unidade = match?.unit || (parsed.variations.length === 1 ? parsed.variations[0].unit : null) || it.unidade || "UN";
      const patch: any = {};
      if (ncm && ncm !== it.ncm_hs) patch.ncm_hs = ncm;
      if (gtin && gtin !== it.gtin_ean) patch.gtin_ean = gtin;
      if (unidade && unidade !== it.unidade) patch.unidade = unidade;
      // Se item não tem presentation_qty, adota a 1ª variação do card
      if (!it.presentation_qty && parsed.variations[0]?.qty && (byCatalog.get(it.catalog_product_id || "")?.length ?? 0) === 1) {
        patch.presentation_qty = parsed.variations[0].qty;
        if (parsed.variations[0].gtin) patch.gtin_ean = parsed.variations[0].gtin;
        if (parsed.variations[0].unit) patch.unidade = parsed.variations[0].unit;
      }
      if (Object.keys(patch).length > 0) {
        rowsUpdated++;
        updateOps.push(async () =>
          await supabase.from("dealer_price_items" as any).update(patch).eq("id", it.id),
        );
        nextItems.push({ ...it, ...patch });
      } else {
        nextItems.push(it);
      }

      // Expansão: se este item é o único do catálogo e há mais variações, insere linhas irmãs
      if (it.catalog_product_id && (byCatalog.get(it.catalog_product_id)?.length ?? 0) === 1 && parsed.variations.length > 1) {
        const extra = parsed.variations.slice(1);
        extra.forEach((v, idx) => {
          insertPayload.push({
            price_list_id: list.id,
            catalog_product_id: it.catalog_product_id,
            cod: it.cod,
            name: it.name,
            name_en: it.name_en,
            name_es: it.name_es,
            image_url: it.image_url,
            category: it.category,
            subcategory: it.subcategory,
            description: it.description,
            ncm_hs: ncm,
            gtin_ean: v.gtin || null,
            price_base: it.price_base,
            discount_pct: it.discount_pct,
            price_dealer: it.price_dealer,
            unidade: v.unit || it.unidade || "UN",
            presentation: it.presentation || "Unid",
            quantity_multiplier: 1,
            presentation_qty: v.qty,
            sort_order: (it.sort_order ?? 0) + idx + 1,
            is_active: it.is_active !== false,
          });
          rowsInserted++;
        });
        // Marca este catálogo como já expandido para não repetir no loop
        byCatalog.set(it.catalog_product_id, [it, ...extra.map(() => it)]);
      }
    }

    const results = await Promise.all(updateOps.map((op) => op()));
    const failed = results.find((r: any) => r?.error);
    if (failed) { toast.error((failed as any).error.message); setSaving(false); return; }
    if (insertPayload.length > 0) {
      const { error: insErr } = await supabase.from("dealer_price_items" as any).insert(insertPayload);
      if (insErr) { toast.error(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    if (rowsUpdated === 0 && rowsInserted === 0) {
      toast.info("Nenhuma variação nova encontrada no catálogo.");
      return;
    }
    toast.success(`Variações sincronizadas: ${rowsUpdated} atualizadas, ${rowsInserted} novas`);
    await loadOrCreate(distributorId);
    await autoSnapshot(`Sync variações (+${rowsInserted}, ~${rowsUpdated})`, nextItems);
  };

  const recalcAndPersist = async (
    targetCurrency: string,
    opts: { snapshotLabel: string | null } = { snapshotLabel: null },
  ) => {
    if (!list || items.length === 0) return { updated: 0, fallback: 0 };
    const ids = items.map((i) => i.catalog_product_id).filter(Boolean) as string[];
    if (ids.length === 0) { toast.info("Nenhum item ligado ao catálogo."); return { updated: 0, fallback: 0 }; }
    setSaving(true);
    const { data: cat, error } = await supabase
      .from("system_a_catalog" as any)
      .select("id,price,price_usd,price_eur")
      .in("id", ids);
    if (error) { toast.error(error.message); setSaving(false); return { updated: 0, fallback: 0 }; }
    const cur = (targetCurrency || "BRL").toUpperCase();
    const byId = new Map<string, any>(((cat as any) || []).map((p: any) => [p.id, p]));
    let updated = 0;
    let fallback = 0;
    const nextItems: DealerPriceItem[] = items.map((it) => {
      const p = it.catalog_product_id ? byId.get(it.catalog_product_id) : null;
      if (!p) return it;
      const pick = cur === "USD" ? p.price_usd : cur === "EUR" ? p.price_eur : p.price;
      let value = Number(pick);
      if (!(value > 0)) { const brl = Number(p.price) || 0; value = brl; if (cur !== "BRL" && brl > 0) fallback++; }
      if (!(value > 0)) return it;
      const price_dealer = recalcDealerPrice(value, Number(it.discount_pct) || 0);
      updated++;
      return { ...it, price_base: value, price_dealer };
    });
    // Persist updates in parallel
    const changed = nextItems.filter((n, i) => n !== items[i]);
    const results = await Promise.all(
      changed.map((n) =>
        supabase.from("dealer_price_items" as any)
          .update({ price_base: n.price_base, price_dealer: n.price_dealer })
          .eq("id", n.id),
      ),
    );
    const failed = results.find((r: any) => r.error);
    if (failed) { toast.error((failed as any).error.message); setSaving(false); return { updated: 0, fallback: 0 }; }
    setItems(nextItems);
    setDirtyIds(new Set());
    setSaving(false);
    toast.success(`${updated} preços recalculados (${cur})`);
    if (fallback > 0) toast.warning(`${fallback} itens sem preço em ${cur} — usando BRL como fallback`);
    if (opts.snapshotLabel) await autoSnapshot(opts.snapshotLabel, nextItems);
    return { updated, fallback };
  };

  const updateField = (id: string, field: keyof DealerPriceItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next: DealerPriceItem = { ...it, [field]: value } as any;
        if (field === "price_base" || field === "discount_pct") {
          next.price_dealer = recalcDealerPrice(Number(next.price_base), Number(next.discount_pct));
        } else if (field === "price_dealer") {
          next.discount_pct = recalcDiscount(Number(next.price_base), Number(next.price_dealer));
        }
        return next;
      }),
    );
    setDirtyIds((s) => new Set(s).add(id));
  };

  const saveAll = async () => {
    if (!list || dirtyIds.size === 0) return;
    setSaving(true);
    const toSave = items.filter((i) => dirtyIds.has(i.id));
    for (const it of toSave) {
      const { error } = await supabase
        .from("dealer_price_items" as any)
        .update({
          cod: it.cod, name: it.name, ncm_hs: it.ncm_hs, gtin_ean: it.gtin_ean,
          variant: it.variant, unidade: it.unidade, description: it.description,
          presentation: it.presentation || "Unid",
          quantity_multiplier: Number(it.quantity_multiplier ?? 1),
          presentation_qty: it.presentation_qty ?? null,
          price_base: it.price_base, discount_pct: it.discount_pct, price_dealer: it.price_dealer,
        })
        .eq("id", it.id);
      if (error) { toast.error(`Erro em ${it.name}: ${error.message}`); setSaving(false); return; }
    }
    toast.success(`${toSave.length} linhas salvas`);
    setDirtyIds(new Set());
    setSaving(false);
    await autoSnapshot(`${t.autoEdit} (${toSave.length})`, items);
  };

  const saveSnapshot = async () => {
    if (!list || !distributorId) return;
    if (dirtyIds.size > 0) {
      await saveAll();
    }
    const label = snapshotLabel.trim() || `Cotação ${new Date().toLocaleString("pt-BR")}`;
    const { error } = await supabase.from("dealer_price_list_snapshots" as any).insert({
      distributor_id: distributorId,
      price_list_id: list.id,
      label,
      currency: list.currency,
      language: list.language,
      items: items as any,
      totals: totals as any,
    });
    if (error) { toast.error("Erro ao salvar histórico: " + error.message); return; }
    toast.success("Tabela salva no histórico");
    setSnapshotLabel("");
    // reload snapshots
    const { data: snaps } = await supabase
      .from("dealer_price_list_snapshots" as any)
      .select("id,distributor_id,price_list_id,label,currency,language,items,totals,created_at")
      .eq("distributor_id", distributorId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSnapshots(((snaps as any) || []) as DealerSnapshot[]);
  };

  const removeItem = async (id: string) => {
    if (!confirm("Remover este item da tabela?")) return;
    const removed = items.find((i) => i.id === id);
    const { error } = await supabase.from("dealer_price_items" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    await autoSnapshot(`${t.autoRemove}: ${removed?.name ?? id.slice(0, 8)}`, next);
  };

  const toggleItemActive = async (id: string, next: boolean) => {
    const { error } = await supabase
      .from("dealer_price_items" as any)
      .update({ is_active: next })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: next } : i)));
  };

  const deleteSnapshot = async (id: string) => {
    if (!confirm(t.confirmDeleteSnapshot)) return;
    const { error } = await supabase.from("dealer_price_list_snapshots" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
    toast.success(t.snapshotDeleted);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, DealerPriceItem[]>();
    const visibleItems = showInactive ? items : items.filter((i) => i.is_active !== false);
    visibleItems.forEach((i) => {
      const key = `${i.category || t.noCategory} / ${i.subcategory || "—"}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const ra = categoryRank(a[0]?.category, a[0]?.subcategory);
      const rb = categoryRank(b[0]?.category, b[0]?.subcategory);
      return ra - rb;
    });
  }, [items, t, showInactive]);

  const lineTotal = (it: DealerPriceItem) =>
    Number(it.price_dealer || 0) * Number(it.quantity_multiplier ?? 1);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (a, b) => a + Number(b.price_base || 0) * Number(b.quantity_multiplier ?? 1),
      0,
    );
    const total = items.reduce((a, b) => a + lineTotal(b), 0);
    return { subtotal, total, discount: subtotal - total };
  }, [items]);

  const reloadSnapshots = async () => {
    if (!distributorId) return;
    const { data: snaps } = await supabase
      .from("dealer_price_list_snapshots" as any)
      .select("id,distributor_id,price_list_id,label,currency,language,items,totals,created_at")
      .eq("distributor_id", distributorId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSnapshots(((snaps as any) || []) as DealerSnapshot[]);
  };

  const autoSnapshot = async (label: string, itemsSnap: DealerPriceItem[]) => {
    if (!list || !distributorId) return;
    const subtotal = itemsSnap.reduce((a, b) => a + Number(b.price_base || 0) * Number(b.quantity_multiplier ?? 1), 0);
    const total = itemsSnap.reduce((a, b) => a + Number(b.price_dealer || 0) * Number(b.quantity_multiplier ?? 1), 0);
    await supabase.from("dealer_price_list_snapshots" as any).insert({
      distributor_id: distributorId,
      price_list_id: list.id,
      label,
      currency: list.currency,
      language: list.language,
      items: itemsSnap as any,
      totals: { subtotal, total, discount: subtotal - total } as any,
    });
    reloadSnapshots();
  };

  const restoreSnapshot = async (s: DealerSnapshot) => {
    if (!list || !confirm(t.restoreConfirm)) return;
    setSaving(true);
    // 1. Auto-snapshot atual antes de sobrescrever
    await autoSnapshot(`${t.autoRestore} — snapshot pré-restauração`, items);
    // 2. Apaga itens atuais
    const { error: delErr } = await supabase.from("dealer_price_items" as any).delete().eq("price_list_id", list.id);
    if (delErr) { toast.error(delErr.message); setSaving(false); return; }
    // 3. Insere itens do snapshot
    const arr = Array.isArray(s.items) ? (s.items as any[]) : [];
    const toInsert = arr.map((it: any, idx: number) => ({
      price_list_id: list.id,
      catalog_product_id: it.catalog_product_id ?? null,
      cod: it.cod ?? null, name: it.name ?? "",
      name_en: it.name_en ?? null, name_es: it.name_es ?? null,
      image_url: it.image_url ?? null,
      category: it.category ?? null, subcategory: it.subcategory ?? null, variant: it.variant ?? null,
      ncm_hs: it.ncm_hs ?? null, gtin_ean: it.gtin_ean ?? null,
      unidade: it.unidade ?? "UN", description: it.description ?? null,
      price_base: Number(it.price_base) || 0,
      discount_pct: Number(it.discount_pct) || 0,
      price_dealer: Number(it.price_dealer) || 0,
      presentation: it.presentation ?? "Unid",
      quantity_multiplier: Number(it.quantity_multiplier ?? 1) || 1,
      presentation_qty: it.presentation_qty ?? null,
      sort_order: idx,
    }));
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from("dealer_price_items" as any).insert(toInsert);
      if (insErr) { toast.error(insErr.message); setSaving(false); return; }
    }
    toast.success(`Versão de ${new Date(s.created_at).toLocaleString("pt-BR")} restaurada`);
    setSaving(false);
    await loadOrCreate(distributorId);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[280px]">
          <label className="text-xs text-muted-foreground">{t.distributor}</label>
          <Select value={distributorId} onValueChange={setDistributorId}>
            <SelectTrigger><SelectValue placeholder={t.selectPlaceholder} /></SelectTrigger>
            <SelectContent>
              {distributors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome_fantasia || d.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {list && (
          <>
            <Button variant="outline" onClick={importCatalog} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-1" /> {t.importCatalog}
            </Button>
            <Button onClick={saveAll} disabled={saving || dirtyIds.size === 0}>
              {saving ? `${t.save}…` : dirtyIds.size > 0 ? `${t.save} (${dirtyIds.size})` : t.saved}
            </Button>
            <div className="flex items-center gap-1">
              <Input
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder={t.snapshotPlaceholder}
                className="h-9 w-[220px]"
              />
              <Button variant="secondary" onClick={saveSnapshot} disabled={items.length === 0}>
                <Save className="w-4 h-4 mr-1" /> {t.saveSnapshot}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowHistory((s) => !s)}>
              <History className="w-4 h-4 mr-1" /> {t.history} ({snapshots.length})
            </Button>
            <div className="flex items-center gap-2 px-2 border rounded-md h-9">
              <Switch id="show-inactive-items" checked={showInactive} onCheckedChange={setShowInactive} />
              <label htmlFor="show-inactive-items" className="text-xs text-muted-foreground cursor-pointer select-none">{t.showInactive}</label>
            </div>
            <Button variant="outline" onClick={() => exportPriceTableXlsx(distributor, list, items)}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> XLSX
            </Button>
            <Button variant="outline" onClick={() => exportPriceTablePdf(distributor, list, items)}>
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" onClick={() => exportPriceTableDocx(distributor, list, items)}>
              <FileType className="w-4 h-4 mr-1" /> DOCX
            </Button>
            {onGenerateProposal && (
              <Button variant="secondary" onClick={() => onGenerateProposal(list, items)}>
                {t.generateProposal}
              </Button>
            )}
          </>
        )}
      </div>

      {list && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline">v{list.version}</Badge>
            <span className="text-muted-foreground">{t.currency}:</span>
            <Select
              value={list.currency || "BRL"}
              onValueChange={async (v) => {
                const { data } = await supabase
                  .from("dealer_price_lists" as any)
                  .update({ currency: v }).eq("id", list.id).select("*").single();
                if (data) setList(data as unknown as DealerPriceList);
                if (v && v !== list.currency) {
                  await recalcAndPersist(v, { snapshotLabel: `Moeda alterada para ${v} (recalc do catálogo)` });
                }
              }}
            >
              <SelectTrigger className="h-7 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["BRL","USD","EUR","GBP","ARS","CLP","COP","MXN","PEN","UYU","PYG","BOB"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={recalcFromCatalog} disabled={saving || items.length === 0} className="h-7">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t.recalcFromCatalog}
            </Button>
            <span className="text-muted-foreground">{t.language}:</span>
            <Select
              value={list.language || "pt"}
              onValueChange={async (v) => {
                const { data } = await supabase
                  .from("dealer_price_lists" as any)
                  .update({ language: v }).eq("id", list.id).select("*").single();
                if (data) setList(data as unknown as DealerPriceList);
              }}
            >
              <SelectTrigger className="h-7 w-[90px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">PT</SelectItem>
                <SelectItem value="es">ES</SelectItem>
                <SelectItem value="en">EN</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">{t.items}:</span>
            <strong>{items.length}</strong>
            <span className="text-muted-foreground">{t.tableTotal}:</span>
            <strong>{formatMoney(totals.subtotal, currency)}</strong>
            <span className="text-muted-foreground">{t.dealerTotal}:</span>
            <strong className="text-primary">{formatMoney(totals.total, currency)}</strong>
            <span className="text-muted-foreground">{t.discount}:</span>
            <strong className="text-amber-600">
              {totals.subtotal > 0 ? ((totals.discount / totals.subtotal) * 100).toFixed(1) : "0"}%
            </strong>
          </CardContent>
        </Card>
      )}

      {showHistory && list && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" /> {t.historyTitle} — {distributor?.nome_fantasia || distributor?.razao_social}
            </h4>
            {snapshots.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.noSnapshots}</p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.date}</TableHead>
                      <TableHead>{t.label}</TableHead>
                      <TableHead>{t.currency}</TableHead>
                      <TableHead>{t.language}</TableHead>
                      <TableHead className="text-right">{t.items}</TableHead>
                      <TableHead className="text-right">{t.totalDealer}</TableHead>
                      <TableHead className="text-right w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((s) => {
                      const arr = Array.isArray(s.items) ? s.items : [];
                      const t = (s.totals && (s.totals as any).total) ?? 0;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-sm">{s.label || "—"}</TableCell>
                          <TableCell>{s.currency}</TableCell>
                          <TableCell className="uppercase">{s.language}</TableCell>
                          <TableCell className="text-right">{arr.length}</TableCell>
                          <TableCell className="text-right font-semibold">{formatMoney(t, s.currency)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => restoreSnapshot(s)} disabled={saving}>
                              <RotateCcw className="w-3 h-3 mr-1" /> Restaurar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-1 text-destructive hover:text-destructive"
                              onClick={() => deleteSnapshot(s.id)}
                              disabled={saving}
                              title={t.deleteSnapshot}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : !list ? (
        <p className="text-sm text-muted-foreground">{t.selectPrompt}</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {t.emptyTable} <strong>{t.importCatalog}</strong> {t.populateAll}
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, rows]) => (
            <div key={group}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t.catDiscount}</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={catDiscount[group] ?? ""}
                    onChange={(e) => setCatDiscount((s) => ({ ...s, [group]: e.target.value }))}
                    className="h-8 w-20 text-right"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const raw = (catDiscount[group] ?? "").replace(",", ".").trim();
                      const pct = parseFloat(raw);
                      if (isNaN(pct) || pct < 0 || pct > 100) { toast.error("0 – 100"); return; }
                      rows.forEach((r) => updateField(r.id, "discount_pct", pct));
                      toast.success(`${rows.length} × ${pct}%`);
                    }}
                  >
                    {t.apply}
                  </Button>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table className="min-w-[1500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{t.hPhoto}</TableHead>
                      <TableHead className="w-28">{t.hCod}</TableHead>
                      <TableHead className="min-w-[280px]">{t.hProduct}</TableHead>
                      <TableHead className="w-20">{t.hPresQty}</TableHead>
                      <TableHead className="w-24">{t.hPres}</TableHead>
                      <TableHead className="w-32">{t.hNcm}</TableHead>
                      <TableHead className="w-40">{t.hGtin}</TableHead>
                      <TableHead className="w-20">{t.hUnit}</TableHead>
                      <TableHead className="w-32">{t.hTablePrice}</TableHead>
                      <TableHead className="w-24">{t.hDiscount}</TableHead>
                      <TableHead className="w-32">{t.hDealerUnit}</TableHead>
                      <TableHead className="w-32">{t.hDealerTotal}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Group variations of the same product (same name + same image)
                      // so FOTO / COD / PRODUTO render once with rowSpan across
                      // all presentations (1000g / 500g / 250g etc.).
                      const groupKey = (it: DealerPriceItem) =>
                        `${(it.name || "").trim().toLowerCase()}|${it.image_url || ""}`;
                      const seen = new Map<string, { leader: string; size: number }>();
                      for (const it of rows) {
                        const k = groupKey(it);
                        const g = seen.get(k);
                        if (!g) seen.set(k, { leader: it.id, size: 1 });
                        else g.size += 1;
                      }
                      const updateGroupField = (leaderId: string, field: keyof DealerPriceItem, value: any) => {
                        const leader = rows.find((r) => r.id === leaderId);
                        if (!leader) return;
                        const k = groupKey(leader);
                        rows.forEach((r) => { if (groupKey(r) === k) updateField(r.id, field, value); });
                      };
                      return rows.map((it) => {
                        const k = groupKey(it);
                        const g = seen.get(k)!;
                        const isLeader = g.leader === it.id;
                        const span = g.size;
                        return (
                     <TableRow key={it.id} className={`${dirtyIds.has(it.id) ? "bg-amber-50/40 " : ""}${it.is_active === false ? "opacity-50" : ""}`}>
                        {isLeader && (
                        <TableCell rowSpan={span} className="align-middle">
                          {it.image_url ? (
                            <img src={it.image_url} alt="" className="w-10 h-10 object-contain bg-muted rounded" />
                          ) : <ImageOff className="w-5 h-5 text-muted-foreground" />}
                        </TableCell>
                        )}
                        {isLeader && (
                        <TableCell rowSpan={span} className="align-middle">
                          <Input value={it.cod ?? ""} onChange={(e) => updateGroupField(it.id, "cod", e.target.value)} className="h-8" />
                        </TableCell>
                        )}
                        {isLeader && (
                        <TableCell rowSpan={span} className="align-middle">
                          <Input
                            value={displayName(it)}
                            onChange={(e) => {
                              const field = lang === "es" ? "name_es" : lang === "en" ? "name_en" : "name";
                              updateGroupField(it.id, field as any, e.target.value);
                            }}
                            className="h-8"
                          />
                        </TableCell>
                        )}
                        <TableCell>
                          <Input
                            type="text"
                            value={it.presentation_qty ?? ""}
                            placeholder="—"
                            onChange={(e) => updateField(it.id, "presentation_qty" as any, e.target.value || null)}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={(it.presentation as string) || "Unit"}
                            onValueChange={(v) => updateField(it.id, "presentation" as any, v)}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRESENTATION_OPTIONS.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={it.ncm_hs ?? ""} onChange={(e) => updateField(it.id, "ncm_hs", e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Input value={it.gtin_ean ?? ""} onChange={(e) => updateField(it.id, "gtin_ean", e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.quantity_multiplier ?? 1}
                            onChange={(e) => updateField(it.id, "quantity_multiplier" as any, parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" value={it.price_base ?? 0}
                            onChange={(e) => updateField(it.id, "price_base", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={it.discount_pct ?? 0}
                            onChange={(e) => {
                              const v = e.target.value.replace(",", ".");
                              const n = parseFloat(v);
                              updateField(it.id, "discount_pct", isNaN(n) ? 0 : n);
                            }}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" value={it.price_dealer ?? 0}
                            onChange={(e) => updateField(it.id, "price_dealer", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right font-semibold" />
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary text-sm whitespace-nowrap">
                          {formatMoney(lineTotal(it), currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleItemActive(it.id, !(it.is_active !== false))}
                              title={it.is_active !== false ? t.active : t.inactive}
                            >
                              {it.is_active !== false
                                ? <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => removeItem(it.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
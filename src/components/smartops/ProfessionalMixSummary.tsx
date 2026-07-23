import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Star, Trophy } from "lucide-react";

// ---------- Classificação de categorias ----------
// Ordem importa: primeiras regras vencem.
type Cat =
  | "scanner_intraoral"
  | "scanner_bancada"
  | "impressora"
  | "pos_impressao"
  | "fresadora"
  | "cad"
  | "resina_3d"
  | "caracterizacao"
  | "limpeza"
  | "cimentos"
  | "resinas_diretas"
  | "adesivos"
  | "blocos_fresagem"
  | "outros";

const CAT_LABEL: Record<Cat, string> = {
  scanner_intraoral: "Scanner intraoral",
  scanner_bancada: "Scanner de bancada",
  impressora: "Impressora 3D",
  pos_impressao: "Pós-impressão (cura)",
  fresadora: "Fresadora",
  cad: "CAD / Software",
  resina_3d: "Resinas 3D",
  caracterizacao: "Caracterização",
  limpeza: "Limpeza & Finalização",
  cimentos: "Cimentos",
  resinas_diretas: "Resinas diretas",
  adesivos: "Adesivos",
  blocos_fresagem: "Blocos & Fresagem",
  outros: "Outros",
};

const EQUIPMENT_CATS: Cat[] = [
  "scanner_intraoral",
  "scanner_bancada",
  "impressora",
  "pos_impressao",
  "fresadora",
  "cad",
];
const CONSUMABLE_CATS: Cat[] = [
  "resina_3d",
  "caracterizacao",
  "limpeza",
  "cimentos",
  "resinas_diretas",
  "adesivos",
  "blocos_fresagem",
];

const ACCESSORY_RE =
  /\b(painel\s+lcd|tela\s+lcd|teflon|fep|nfep|pelicula|película|filme\s+lcd|filtro|fonte|placa\s+m[ãa]e|cabo|parafuso|kit\s+(?:de\s+)?(?:reposi[çc][ãa]o|manuten[çc][ãa]o)|reposi[çc][ãa]o|manuten[çc][ãa]o|spare|cartucho|bandeja|plataforma\s+de?\s+constru[çc][ãa]o|build\s*plate|vat|cuba|garantia|extensao|extensão|treinamento|curso|aula|consultoria|servi[çc]o|frete|instala[çc][ãa]o)\b/i;

function classify(name: string, category: string | null | undefined): Cat {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();
  // Category first
  if (c.includes("scanner intraoral")) return "scanner_intraoral";
  if (c.includes("scanner") && c.includes("bancad")) return "scanner_bancada";
  if (c.includes("impressora")) return "impressora";
  if (c.includes("pós-cura") || c.includes("pos-cura") || c.includes("pós cura")) return "pos_impressao";
  if (c.includes("software cad") || c.includes("cad/cam") || c.includes("cad")) return "cad";
  if (c.includes("kit caracteriz") || c.includes("caracteriz")) return "caracterizacao";
  if (c.includes("resina 3d")) return "resina_3d";
  // Name-based fallback
  if (/\b(medit\s*i[567]00|i600|i700|aoralscan|trios\s*\d|itero|primescan|panda\s*p\d|launca|runyes|shining|emerald)\b/.test(n)) return "scanner_intraoral";
  if (/\b(scanner\s+de\s+bancada|e1\b|e2\b|e3\b|freedom\s+hd|medit\s*t|autoscan)\b/.test(n)) return "scanner_bancada";
  if (/\b(halot|elegoo|mars\s*\d|saturn\s*\d|phrozen|sonic\s+(mini|mighty|xl)|anycubic|miicraft|rayshape|edge\s*mini|nextdent|asiga|formlabs)\b/.test(n)) return "impressora";
  if (/\b(wash\s*&?\s*cure|cure\s*m|mercury|nova\s*cure|c-?cure|pos\s*cura|pós\s*cura|uv\s*cure|cura\s+uv)\b/.test(n)) return "pos_impressao";
  if (/\b(fresadora|mill|k5|dwx|imes|roland\s+dwx|blz\s*mill)\b/.test(n)) return "fresadora";
  if (/\b(exocad|exoplan|medit\s+clinic\s+app|blzdental|cad\s*lite|cad\s*pro|3shape\s+(design|dental))\b/.test(n)) return "cad";
  if (/\b(cimento|cement|luting)\b/.test(n)) return "cimentos";
  if (/\b(adesivo|primer|bond(?:ing)?)\b/.test(n)) return "adesivos";
  if (/\b(resina\s+direta|resina\s+composta|composita|composite|z\d{3}|filtek|opallis|charisma|tetric|palfique|estelite)\b/.test(n)) return "resinas_diretas";
  if (/\b(bloco|disco|zircon|dissilicat|ips\s*e\.?max|pmma|cera\s+cad|puck)\b/.test(n)) return "blocos_fresagem";
  if (/\b(caracteriz|maquiag|pigment|corante|stain|shade)\b/.test(n)) return "caracterizacao";
  if (/\b(isopropi|álcool|alcool|filme|lixa|disco\s+de\s+polim|polim|finaliz|limpeza|detergente|glicerina)\b/.test(n)) return "limpeza";
  if (/\bresina\b/.test(n)) return "resina_3d";
  return "outros";
}

// ---------- Utils ----------
function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function experienceLabel(fromIso: string | null | undefined): string {
  if (!fromIso) return "—";
  const from = new Date(fromIso).getTime();
  const now = Date.now();
  const totalMonths = Math.max(0, Math.floor((now - from) / (1000 * 60 * 60 * 24 * 30.44)));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths - years * 12;
  const y = `${years} ${years === 1 ? "ano" : "anos"}`;
  const m = `${months} ${months === 1 ? "mês" : "meses"}`;
  if (years === 0) return m;
  if (months === 0) return y;
  return `${y} ${m}`;
}

// ---------- Types ----------
type PurchaseItem = {
  name: string;
  category: Cat;
  total: number;
  date: string; // ISO
  vendor?: string | null;
  source: "crm" | "ecom";
};

// ---------- "Equipamentos e software" section categories ----------
type EquipCat =
  | "scanner_3d"
  | "notebook"
  | "dispositivos"
  | "cad"
  | "impressora"
  | "wash_cure"
  | "cura_prof";

const EQUIP_TABLE_ORDER: EquipCat[] = [
  "scanner_3d",
  "notebook",
  "dispositivos",
  "cad",
  "impressora",
  "wash_cure",
  "cura_prof",
];

const EQUIP_TABLE_LABEL: Record<EquipCat, string> = {
  scanner_3d: "Scanner 3D",
  notebook: "Notebook",
  dispositivos: "Dispositivos",
  cad: "CAD",
  impressora: "Impressora 3D",
  wash_cure: "Pós-impressão — Wash & Cure",
  cura_prof: "Pós-impressão — Cura profissional",
};

const DISPOSITIVOS_RE = /\b(blx\s*dental|io\s*connect|dmc\b|smile\s*lite|fotop|mdi|mini\s*dental|led\s*(?:cure|dental))\b/i;
const WASH_CURE_RE = /\bwash\s*&?\s*cure\b|\bwash\s*and\s*cure\b/i;
const CURA_PROF_RE = /\b(asiga\s*cure|magna\s*box|shapecure|shape\s*cure|c[- ]?cure|mercury|nova\s*cure|cure\s*m\b|uv\s*cure|cura\s+uv|pós[- ]?cura|pos[- ]?cura|otoflash)\b/i;
const NOTEBOOK_RE = /\b(notebook|avell|workstation|laptop)\b/i;

function classifyEquipTable(it: PurchaseItem): EquipCat | null {
  const n = (it.name || "").toLowerCase();
  if (NOTEBOOK_RE.test(n)) return "notebook";
  if (DISPOSITIVOS_RE.test(n)) return "dispositivos";
  if (it.category === "scanner_intraoral" || it.category === "scanner_bancada") return "scanner_3d";
  if (it.category === "impressora") return "impressora";
  if (it.category === "cad") return "cad";
  if (it.category === "pos_impressao") {
    if (WASH_CURE_RE.test(n)) return "wash_cure";
    if (CURA_PROF_RE.test(n)) return "cura_prof";
    return "cura_prof";
  }
  return null;
}

interface Props {
  leadId: string | null;
  disabled: boolean;
  cadValue: string;
  onCadChange: (v: string) => void;
}

export default function ProfessionalMixSummary({ leadId, disabled, cadValue, onCadChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [cadOverride, setCadOverride] = useState(false);
  const [cadCatalog, setCadCatalog] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_a_catalog")
        .select("name, product_category, product_subcategory")
        .eq("active", true)
        .eq("approved", true)
        .limit(500);
      const names = (data ?? [])
        .filter((r: any) => {
          const c = `${r.product_category ?? ""} ${r.product_subcategory ?? ""}`.toLowerCase();
          return /software|cad|exocad|exoplan/.test(c) || /exocad|exoplan|clinic\s*app|lite\s*cad|dental\s*cad/i.test(r.name || "");
        })
        .map((r: any) => (r.name || "").trim())
        .filter(Boolean);
      setCadCatalog(Array.from(new Set(names)).sort());
    })();
  }, []);

  useEffect(() => {
    if (!leadId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Won CRM deals
        const { data: wonDeals } = await supabase
          .from("deals")
          .select("id, owner_name, closed_at")
          .eq("lead_id", leadId)
          .eq("status", "ganha");
        const dealIds = (wonDeals ?? []).map((d: any) => d.id);
        const dealOwner = new Map<string, { owner_name: string | null; closed_at: string | null }>();
        (wonDeals ?? []).forEach((d: any) => dealOwner.set(d.id, { owner_name: d.owner_name, closed_at: d.closed_at }));

        const crmItems: PurchaseItem[] = [];
        if (dealIds.length > 0) {
          const { data: rows } = await supabase
            .from("deal_items")
            .select("deal_id, product_name, product_category, total_value, deal_date, vendor_name")
            .in("deal_id", dealIds);
          for (const r of (rows ?? []) as any[]) {
            const name = r.product_name || "";
            if (!name) continue;
            if (ACCESSORY_RE.test(name.toLowerCase())) continue;
            const owner = dealOwner.get(r.deal_id);
            crmItems.push({
              name,
              category: classify(name, r.product_category),
              total: Number(r.total_value) || 0,
              date: (r.deal_date || owner?.closed_at || new Date().toISOString()) as string,
              vendor: r.vendor_name || owner?.owner_name || null,
              source: "crm",
            });
          }
        }

        // E-commerce orders (Loja Integrada)
        const { data: orders } = await supabase
          .from("loja_integrada_orders")
          .select("id, data_pedido, status")
          .eq("attendance_id", leadId);
        const okOrders = (orders ?? []).filter((o: any) => !["cancelado", "cancelled", "estornado"].includes((o.status || "").toLowerCase()));
        const orderIds = okOrders.map((o: any) => o.id);
        const orderDate = new Map<string, string>();
        okOrders.forEach((o: any) => orderDate.set(o.id, o.data_pedido));

        const ecomItems: PurchaseItem[] = [];
        if (orderIds.length > 0) {
          const { data: rows } = await supabase
            .from("loja_integrada_order_items")
            .select("order_id, nome_produto, valor_total")
            .in("order_id", orderIds);
          for (const r of (rows ?? []) as any[]) {
            const name = r.nome_produto || "";
            if (!name) continue;
            if (ACCESSORY_RE.test(name.toLowerCase())) continue;
            ecomItems.push({
              name,
              category: classify(name, null),
              total: Number(r.valor_total) || 0,
              date: orderDate.get(r.order_id) || new Date().toISOString(),
              vendor: "E-commerce",
              source: "ecom",
            });
          }
        }

        // Qualification fallback: use equip_* / produto_interesse from lia_attendances
        // so the MIX table still renders when there are no synced deal_items /
        // e-commerce orders. Injected only for categories not already covered.
        const qualItems: PurchaseItem[] = [];
        try {
          const { data: lead } = await supabase
            .from("lia_attendances")
            .select(
              "created_at, produto_interesse, equip_scanner, equip_scanner_ativacao, equip_scanner_bancada, equip_scanner_bancada_ativacao, equip_notebook, equip_notebook_ativacao, equip_cad, equip_cad_ativacao, equip_impressora, equip_impressora_ativacao, equip_pos_impressao, equip_pos_impressao_ativacao, equip_fresadora, equip_fresadora_ativacao"
            )
            .eq("id", leadId)
            .maybeSingle();
          if (lead) {
            const covered = new Set<Cat>([...crmItems, ...ecomItems].map((i) => i.category));
            const fallbackDate = (lead as any).created_at || new Date().toISOString();
            const push = (raw: any, forced: Cat, ativ?: any) => {
              const name = (raw || "").toString().trim();
              if (!name) return;
              if (ACCESSORY_RE.test(name.toLowerCase())) return;
              if (covered.has(forced)) return;
              qualItems.push({
                name,
                category: forced,
                total: 0,
                date: (ativ || fallbackDate) as string,
                vendor: null,
                source: "qualification" as any,
              });
              covered.add(forced);
            };
            push((lead as any).equip_scanner, "scanner_intraoral", (lead as any).equip_scanner_ativacao);
            push((lead as any).equip_scanner_bancada, "scanner_bancada", (lead as any).equip_scanner_bancada_ativacao);
            push((lead as any).equip_impressora, "impressora", (lead as any).equip_impressora_ativacao);
            push((lead as any).equip_pos_impressao, "pos_impressao", (lead as any).equip_pos_impressao_ativacao);
            push((lead as any).equip_fresadora, "fresadora", (lead as any).equip_fresadora_ativacao);
            push((lead as any).equip_cad, "cad", (lead as any).equip_cad_ativacao);
            // produto_interesse: only if it maps cleanly to a category not yet covered
            const pi = ((lead as any).produto_interesse || "").toString().trim();
            if (pi && !/info\s*geral|informa|geral/i.test(pi)) {
              const cat = classify(pi, null);
              if (cat !== "outros" && !covered.has(cat)) {
                qualItems.push({
                  name: pi,
                  category: cat,
                  total: 0,
                  date: fallbackDate,
                  vendor: null,
                  source: "qualification" as any,
                });
              }
            }
          }
        } catch { /* non-blocking */ }

        if (!cancelled) setItems([...crmItems, ...ecomItems, ...qualItems]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // ---------- Aggregations ----------
  const agg = useMemo(() => {
    const total = items.reduce((s, i) => s + (i.total || 0), 0);
    const byCat = new Map<Cat, { items: PurchaseItem[]; total: number; firstDate: string }>();
    for (const it of items) {
      const b = byCat.get(it.category) ?? { items: [], total: 0, firstDate: it.date };
      b.items.push(it);
      b.total += it.total || 0;
      if (new Date(it.date) < new Date(b.firstDate)) b.firstDate = it.date;
      byCat.set(it.category, b);
    }

    // Group items by name within category
    const byCatByName = new Map<Cat, Array<{ name: string; total: number; firstDate: string; qty: number }>>();
    for (const [cat, b] of byCat.entries()) {
      const nm = new Map<string, { name: string; total: number; firstDate: string; qty: number }>();
      for (const it of b.items) {
        const key = it.name.toLowerCase();
        const prev = nm.get(key);
        if (!prev) nm.set(key, { name: titleCase(it.name), total: it.total || 0, firstDate: it.date, qty: 1 });
        else {
          prev.total += it.total || 0;
          prev.qty += 1;
          if (new Date(it.date) < new Date(prev.firstDate)) prev.firstDate = it.date;
        }
      }
      byCatByName.set(cat, Array.from(nm.values()).sort((a, b) => a.firstDate.localeCompare(b.firstDate)));
    }

    const lastPurchase = items.reduce<PurchaseItem | null>((acc, it) => (!acc || new Date(it.date) > new Date(acc.date) ? it : acc), null);
    const firstPurchase = items.reduce<PurchaseItem | null>((acc, it) => (!acc || new Date(it.date) < new Date(acc.date) ? it : acc), null);

    const consumablesTotal = CONSUMABLE_CATS.reduce((s, c) => s + (byCat.get(c)?.total ?? 0), 0);

    // Expertise tag: distinct categories with at least one purchase (excluding "outros")
    const distinctCats = Array.from(byCat.keys()).filter((c) => c !== "outros" && (byCat.get(c)?.total ?? 0) > 0).length;
    let expertiseTag = "Iniciante";
    let expertiseStars = 1;
    if (distinctCats >= 9) { expertiseTag = "Especialista"; expertiseStars = 5; }
    else if (distinctCats >= 6) { expertiseTag = "Avançado"; expertiseStars = 4; }
    else if (distinctCats >= 3) { expertiseTag = "Intermediário"; expertiseStars = 3; }
    else if (distinctCats >= 1) { expertiseTag = "Iniciante+"; expertiseStars = 2; }

    return { total, byCat, byCatByName, lastPurchase, firstPurchase, consumablesTotal, distinctCats, expertiseTag, expertiseStars };
  }, [items]);

  // ---------- CAD auto-derivation ----------
  const cadAuto = useMemo(() => {
    const cadHist = agg.byCatByName.get("cad") ?? [];
    const exo = cadHist.find((c) => /exocad|exoplan/i.test(c.name));
    if (exo) return exo.name;
    const allNames = items.map((i) => i.name.toLowerCase()).join(" ");
    if (/medit/.test(allNames)) return "Medit Clinic App";
    if (/\bblz\b|blzdental|blx\s*dental/.test(allNames)) return "BLZ Dental Lite CAD";
    if (cadHist[0]) return cadHist[0].name;
    return "";
  }, [agg, items]);

  useEffect(() => {
    if (cadAuto && !cadValue) onCadChange(cadAuto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadAuto]);

  if (!leadId) {
    return (
      <Card>
        <CardHeader><CardTitle>Mix de produtos & Portifólio Smart Dent</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Busque um profissional pelo e-mail para carregar o histórico de compras.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Mix de produtos & Portifólio Smart Dent</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Mix de produtos & Portifólio Smart Dent</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma compra encontrada no histórico Smart Dent (CRM ganho ou e-commerce).</p>
        </CardContent>
      </Card>
    );
  }

  const totalAll = agg.total || 1;
  const consumablesTotal = agg.consumablesTotal || 1;

  // ---------- Equipamentos e software (por modelo) ----------
  type ModelRow = { name: string; firstDate: string; lastDate: string };
  const equipTable = new Map<EquipCat, ModelRow[]>();
  for (const it of items) {
    const cat = classifyEquipTable(it);
    if (!cat) continue;
    const key = it.name.toLowerCase().trim();
    const list = equipTable.get(cat) ?? [];
    let row = list.find((r) => r.name.toLowerCase() === key);
    if (!row) {
      row = { name: titleCase(it.name), firstDate: it.date, lastDate: it.date };
      list.push(row);
      equipTable.set(cat, list);
    } else {
      if (new Date(it.date) < new Date(row.firstDate)) row.firstDate = it.date;
      if (new Date(it.date) > new Date(row.lastDate)) row.lastDate = it.date;
    }
  }
  // CAD: manual override ou auto-derivação (Medit → Clinic App, BLZ → Lite CAD, Exocad/Exoplan já capturado)
  if (!equipTable.get("cad")?.length) {
    if (cadValue) {
      equipTable.set("cad", [{ name: cadValue, firstDate: "", lastDate: "" }]);
    } else if (cadAuto) {
      equipTable.set("cad", [{ name: cadAuto, firstDate: "", lastDate: "" }]);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span>Mix de produtos & Portifólio Smart Dent</span>
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            <Trophy className="w-3 h-3 mr-1" /> {agg.expertiseTag}
          </Badge>
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${i < agg.expertiseStars ? "fill-orange-500 text-orange-500" : "text-muted-foreground/30"}`}
              />
            ))}
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {agg.distinctCats} categorias · experiência desde {formatDate(agg.firstPurchase?.date)} ({experienceLabel(agg.firstPurchase?.date)})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Última compra</div>
            <div className="font-semibold">{formatDate(agg.lastPurchase?.date)}</div>
            <div className="text-xs truncate" title={agg.lastPurchase?.name}>{agg.lastPurchase?.name}</div>
          </div>
          <div className="rounded border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Vendedor da última compra</div>
            <div className="font-semibold truncate">{agg.lastPurchase?.vendor || "—"}</div>
          </div>
          <div className="rounded border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Total investido</div>
            <div className="font-semibold">R$ {agg.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="rounded border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Nº de compras</div>
            <div className="font-semibold">{items.length} itens</div>
          </div>
        </div>

        {/* 2. Equipamentos e software (tabela normativa) */}
        <div>
          <h4 className="font-semibold mb-2">2. Equipamentos e software</h4>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Categoria</th>
                  <th className="px-3 py-2 font-semibold">Produtos adquiridos</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Primeira compra</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Última compra</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Tempo de experiência</th>
                </tr>
              </thead>
              <tbody>
                {EQUIP_TABLE_ORDER.map((cat) => {
                  const rows = (equipTable.get(cat) ?? []).slice();
                  rows.sort((a, b) => (a.firstDate || "").localeCompare(b.firstDate || ""));

                  if (rows.length === 0) {
                    // CAD vazio: "Não identificado" + dropdown com softwares CAD do catálogo
                    if (cat === "cad") {
                      return (
                        <tr key={cat} className="border-t align-top">
                          <td className="px-3 py-2 font-medium">{EQUIP_TABLE_LABEL[cat]}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Não identificado</Badge>
                              <Select
                                value={cadValue || ""}
                                onValueChange={(v) => onCadChange(v)}
                                disabled={disabled && !cadOverride}
                              >
                                <SelectTrigger className="h-8 text-xs w-[260px]">
                                  <SelectValue placeholder="Selecionar CAD do catálogo…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cadCatalog.length === 0 && (
                                    <SelectItem value="__none" disabled>Nenhum CAD ativo no catálogo</SelectItem>
                                  )}
                                  {cadCatalog.map((n) => (
                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!cadOverride && (
                                <Button size="sm" variant="outline" onClick={() => setCadOverride(true)} disabled={disabled}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">—</td>
                          <td className="px-3 py-2 text-muted-foreground">—</td>
                          <td className="px-3 py-2 text-muted-foreground">—</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={cat} className="border-t align-top">
                        <td className="px-3 py-2 font-medium">{EQUIP_TABLE_LABEL[cat]}</td>
                        <td className="px-3 py-2 text-muted-foreground">Sem histórico</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                      </tr>
                    );
                  }

                  return rows.map((r, idx) => (
                    <tr key={`${cat}-${r.name}`} className="border-t align-top">
                      {idx === 0 ? (
                        <td className="px-3 py-2 font-medium" rowSpan={rows.length}>{EQUIP_TABLE_LABEL[cat]}</td>
                      ) : null}
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.firstDate ? formatDate(r.firstDate) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.lastDate ? formatDate(r.lastDate) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.firstDate ? experienceLabel(r.firstDate) : "—"}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Fonte: histórico de compras faturadas (e-commerce) e propostas ganhas no CRM. Tempo de experiência = data atual − primeira compra. CAD é derivado automaticamente (Medit → Clinic App, BLZ → Dental Lite CAD, Exocad/Exoplan pelo histórico) ou selecionado no dropdown do catálogo.
          </p>
        </div>

        {/* Consumíveis */}
        <div>
          <h4 className="font-semibold mb-2">Consumíveis</h4>
          <div className="space-y-3">
            {CONSUMABLE_CATS.map((cat) => {
              const list = agg.byCatByName.get(cat) ?? [];
              const catTotal = agg.byCat.get(cat)?.total ?? 0;
              const pctMix = totalAll > 0 ? (catTotal / totalAll) * 100 : 0;
              const pctCons = consumablesTotal > 0 ? (catTotal / consumablesTotal) * 100 : 0;
              if (list.length === 0) return null;
              const firstDate = agg.byCat.get(cat)?.firstDate;
              return (
                <div key={cat} className="rounded border p-3">
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{CAT_LABEL[cat]}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">{pctCons.toFixed(1)}% consumíveis</Badge>
                      <Badge variant="outline" className="text-xs">{pctMix.toFixed(1)}% mix total</Badge>
                      <Badge variant="outline" className="text-xs">{experienceLabel(firstDate)}</Badge>
                    </div>
                  </div>
                  <ul className="text-xs space-y-1 columns-1 md:columns-2">
                    {list.map((it) => (
                      <li key={it.name} className="flex justify-between gap-2 break-inside-avoid">
                        <span className="truncate" title={it.name}>{it.name} {it.qty > 1 && <span className="text-muted-foreground">×{it.qty}</span>}</span>
                        <span className="text-muted-foreground whitespace-nowrap">{formatDate(it.firstDate)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {CONSUMABLE_CATS.every((c) => (agg.byCatByName.get(c) ?? []).length === 0) && (
              <div className="text-xs text-muted-foreground">Sem histórico de consumíveis.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

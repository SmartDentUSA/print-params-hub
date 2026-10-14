import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";
import { groupKolCatalogCategories } from "@/lib/kolPortfolioGroups";
import { kolRowKey } from "@/lib/kolCommissionDefaults";

interface Row { kind: "category" | "product" | "referral"; category: string | null; subcategory: string | null; product_id: string; percent: number | null; coupon_discount_percent: number | null }

const REFERRAL_BASE = { kind: "referral" as const, category: null, subcategory: null, product_id: "" };

const pct = (v: string) => (v === "" ? null : Math.min(100, Math.max(0, Number(v))));

/** Configurações de comissionamento padrão: copiado para cada KOL no momento da criação. */
export default function KolCommissionDefaultsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [cats, setCats] = useState<{ cat: string; subs: string[] }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<Map<string, Row>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingProduct, setPendingProduct] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const sb = supabase as any;
      const [{ data: t }, { data: cr }, { data: p }] = await Promise.all([
        sb.from("kol_commission_templates").select("id").eq("is_default", true).maybeSingle(),
        sb.from("system_a_catalog").select("product_category, product_subcategory").not("product_category", "is", null).eq("active", true).limit(2000),
        sb.from("system_a_catalog").select("id, name").in("category", PRODUCT_CATALOG_ENTITY_TYPES as unknown as string[]).eq("active", true).eq("approved", true).order("name").limit(1000),
      ]);
      const m = new Map<string, Set<string>>();
      for (const x of (cr ?? []) as any[]) {
        const c = String(x.product_category).trim();
        if (!m.has(c)) m.set(c, new Set());
        if (x.product_subcategory) m.get(c)!.add(String(x.product_subcategory).trim());
      }
      setCats(Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
        .map(([cat, s]) => ({ cat, subs: Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })) })));
      setProducts(((p ?? []) as any[]).map((x) => ({ id: x.id, name: x.name ?? "(sem nome)" })));
      setTemplateId(t?.id ?? null);
      const next = new Map<string, Row>();
      if (t?.id) {
        const { data: items } = await sb.from("kol_commission_template_items").select("*").eq("template_id", t.id);
        for (const i of (items ?? []) as any[]) {
          const r: Row = { kind: i.kind === "produto" ? "product" : i.kind === "indicacao" ? "referral" : "category", category: i.category, subcategory: i.subcategory, product_id: i.product_id ?? "", percent: i.percent == null ? null : Number(i.percent), coupon_discount_percent: i.coupon_discount_percent == null ? null : Number(i.coupon_discount_percent) };
          next.set(kolRowKey(r), r);
        }
      }
      setRows(next);
      setLoading(false);
    })();
  }, [open]);

  const groups = useMemo(() => groupKolCatalogCategories(cats), [cats]);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  const patch = (base: Omit<Row, "percent" | "coupon_discount_percent">, p: Partial<Row>) =>
    setRows((prev) => {
      const k = kolRowKey(base);
      const cur = prev.get(k) ?? { ...base, percent: null, coupon_discount_percent: null };
      const n = new Map(prev); n.set(k, { ...cur, ...p }); return n;
    });

  const save = async () => {
    if (!templateId) return;
    setSaving(true);
    const sb = supabase as any;
    const payload = Array.from(rows.values())
      .filter((r) => r.percent != null || r.coupon_discount_percent != null)
      .map((r) => ({ template_id: templateId, kind: r.kind === "product" ? "produto" : r.kind === "referral" ? "indicacao" : "categoria", category: r.category, subcategory: r.subcategory, product_id: r.product_id || null, percent: r.percent ?? 0, coupon_discount_percent: r.coupon_discount_percent }));
    const del = await sb.from("kol_commission_template_items").delete().eq("template_id", templateId);
    const ins = del.error ? del : payload.length ? await sb.from("kol_commission_template_items").insert(payload) : { error: null };
    setSaving(false);
    if (ins.error) { toast.error("Não foi possível salvar. Apenas administradores alteram o padrão."); return; }
    toast.success("Padrão salvo. KOLs já criados não são alterados.");
  };

  const line = (base: Omit<Row, "percent" | "coupon_discount_percent">, label: string, cls: string, removable = false) => {
    const r = rows.get(kolRowKey(base));
    return (
      <div key={kolRowKey(base)} className={`grid grid-cols-[1fr_130px_150px_36px] gap-2 items-center rounded-md border p-2 ${cls}`}>
        <span className="text-sm">{label}</span>
        <Input type="number" min={0} max={100} step="0.1" placeholder="KOL %" value={r?.percent ?? ""} onChange={(e) => patch(base, { percent: pct(e.target.value) })} />
        <Input type="number" min={0} max={100} step="0.1" placeholder="Cupom %" value={r?.coupon_discount_percent ?? ""} onChange={(e) => patch(base, { coupon_discount_percent: pct(e.target.value) })} />
        {removable ? (
          <Button size="icon" variant="ghost" onClick={() => setRows((p) => { const n = new Map(p); n.delete(kolRowKey(base)); return n; })}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        ) : <span />}
      </div>
    );
  };

  const productRows = Array.from(rows.values()).filter((r) => r.kind === "product");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configurações de comissionamento padrão</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Estes valores são copiados para cada KOL no momento em que ele é criado. Alterar o padrão depois não muda KOLs existentes.
        </p>
        {loading ? <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Carregando…</p> : (
          <div className="space-y-5">
            <div className="grid grid-cols-[1fr_130px_150px_36px] gap-2 text-xs font-medium text-muted-foreground px-2">
              <span>Categoria / subcategoria</span><span>Comissão do KOL (%)</span><span>Desconto do cupom (%)</span><span />
            </div>
            {groups.map((g) => (
              <section key={g.label} className="space-y-2">
                <h3 className="border-b pb-2 text-sm font-semibold">{g.label}</h3>
                {g.categories.flatMap((c) => [
                  line({ kind: "category", category: c.cat, subcategory: null, product_id: "" }, `${c.cat} (todas as subcategorias)`, "bg-muted/40 font-medium"),
                  ...c.subs.map((s) => line({ kind: "category", category: c.cat, subcategory: s, product_id: "" }, s, "ml-6")),
                ])}
              </section>
            ))}
            <section className="space-y-2">
              <h3 className="border-b pb-2 text-sm font-semibold">Exceções por produto</h3>
              {productRows.map((r) => line({ kind: "product", category: null, subcategory: null, product_id: r.product_id }, productName(r.product_id), "", true))}
              <div className="flex gap-2">
                <Select value={pendingProduct} onValueChange={setPendingProduct}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um produto…" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" disabled={!pendingProduct} onClick={() => { patch({ kind: "product", category: null, subcategory: null, product_id: pendingProduct }, {}); setPendingProduct(""); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </section>
            <div className="flex justify-end"><Button onClick={save} disabled={saving || !templateId}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar padrão</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

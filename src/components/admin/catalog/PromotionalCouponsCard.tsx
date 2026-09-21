import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Copy, Loader2, RefreshCw, Store, Ticket, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import type { PromotionalCoupon, PromotionalTable } from "./promotionalTypes";

type Seller = { id: string; nome_completo: string; whatsapp_number?: string | null };
type CouponKind = "discount" | "freight";

/** Cupons antigos não têm "kind"; tratamos pelo campo de frete grátis. */
const couponKind = (coupon: PromotionalCoupon): CouponKind =>
  coupon.free_shipping || coupon.kind === "freight" ? "freight" : "discount";
type LiCategory = { id: number; nome: string; parent_id: number | null };

/** Categorias da loja liberadas por padrão nas promoções de evento. */
const DEFAULT_CATEGORY_IDS = [
  23783660, 23783662,                                             // Resinas 3D: Biocompatíveis, Uso geral
  23791999,                                                       // Pós-Impressão: Acabamento e Finalização
  23792018, 23792019,                                             // Caracterização: SmartGum, SmartMake
  23791995, 23824438, 23791996, 23824571, 23824557, 23791997,     // Dentística, Estética e Ortodontia
  23824433, 23791988, 23791989,                                   // Insumos Laboratório
];

const slug = (value: string) =>
  value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "").slice(0, 12);

/** Iniciais do vendedor: primeira letra do nome + primeira letra do sobrenome. */
const sellerInitials = (value: string) => {
  const parts = slug(value).length ? value.trim().split(/\s+/).filter(Boolean) : [];
  const first = slug(parts[0] || "").slice(0, 1);
  const last = slug(parts.length > 1 ? parts[parts.length - 1] : "").slice(0, 1);
  return `${first}${last}` || "XX";
};

/** Número do desconto usado no código do cupom (20% => "20"; R$ 150 => "150"). */
const discountToken = (value: number) => String(Math.round(Number(value) || 0));

type Props = {
  table: PromotionalTable;
  draft: Partial<PromotionalTable>;
  onDraftChange: (patch: Partial<PromotionalTable>) => void;
};

export function PromotionalCouponsCard({ table, draft, onDraftChange }: Props) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [coupons, setCoupons] = useState<PromotionalCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<CouponKind | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sellerSource, setSellerSource] = useState<"event" | "team">("team");
  const [categories, setCategories] = useState<LiCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const selected = (draft.coupon_seller_ids || []) as string[];
  const discountType = (draft.coupon_discount_type || "percent") as "percent" | "fixed";
  const categoryIds = (draft.coupon_li_category_ids || []) as number[];

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-promo-coupons-sync", {
        body: { mode: "categories" },
      });
      if (error) throw error;
      setCategories(((data as { categories?: LiCategory[] })?.categories || []));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar as categorias da loja.");
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const toggleCategory = (id: number) => {
    const next = categoryIds.includes(id) ? categoryIds.filter((row) => row !== id) : [...categoryIds, id];
    onDraftChange({ coupon_li_category_ids: next });
  };

  const loadSellers = useCallback(async () => {
    // Mesma lista liberada no formulário do evento; sem evento, toda a equipe ativa.
    let ids: string[] = [];
    if (draft.event_id) {
      const { data, error: formsError } = await supabase
        .from("smartops_forms" as any)
        .select("event_consultant_ids,updated_at")
        .eq("event_id", draft.event_id)
        .order("updated_at", { ascending: false });
      if (formsError) toast.error(formsError.message);
      for (const form of ((data as any) || [])) {
        for (const id of (form.event_consultant_ids || [])) if (!ids.includes(id)) ids.push(id);
      }
    }
    setSellerSource(ids.length ? "event" : "team");
    let query = supabase.from("team_members" as any)
      .select("id,nome_completo,whatsapp_number").eq("ativo", true).order("nome_completo");
    if (ids.length) query = query.in("id", ids);
    const { data: rows, error } = await query;
    if (error) toast.error(error.message);
    const list = ((rows as any) || []) as Seller[];
    setSellers(list);
    // Pré-seleciona os consultores do estande — quem for escolhido no formulário
    // é o responsável do lead no CRM, e cada um recebe seu próprio cupom.
    if (ids.length && !(draft.coupon_seller_ids || []).length && list.length) {
      onDraftChange({ coupon_seller_ids: list.map((row) => row.id) });
    }
  }, [draft.event_id]);

  const loadCoupons = useCallback(async () => {
    const { data, error } = await supabase
      .from("promotional_coupons" as any)
      .select("*")
      .eq("promotional_table_id", table.id)
      .order("seller_name");
    if (error) toast.error(error.message);
    setCoupons(((data as any) || []) as PromotionalCoupon[]);
  }, [table.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSellers(), loadCoupons()]).finally(() => setLoading(false));
  }, [loadSellers, loadCoupons]);

  const toggleSeller = (id: string) => {
    const next = selected.includes(id) ? selected.filter((row) => row !== id) : [...selected, id];
    onDraftChange({ coupon_seller_ids: next });
  };

  const prefix = slug(draft.coupon_prefix || draft.name || table.name || "PROMO") || "PROMO";

  const generateCoupons = async (kind: CouponKind = "discount") => {
    if (!selected.length) { toast.error("Selecione os vendedores autorizados."); return; }
    const isFreight = kind === "freight";
    const value = Number(
      (isFreight ? draft.coupon_freight_discount_value ?? draft.coupon_discount_value : draft.coupon_discount_value) || 0,
    );
    if (value <= 0) { toast.error("Informe o valor do desconto do cupom."); return; }
    const validFrom = (isFreight ? draft.coupon_freight_valid_from : draft.coupon_valid_from) ?? null;
    const validUntil = (isFreight ? draft.coupon_freight_valid_until : draft.coupon_valid_until) ?? null;
    // Cupons de vendedor são sempre de uso ilimitado até a data final.
    const usageLimit = null;

    setBusy(kind);
    try {
      // Persiste os dados da promoção antes de gerar os códigos.
      await supabase.from("promotional_tables" as any).update({
        coupon_seller_ids: selected,
        coupon_discount_type: discountType,
        coupon_discount_value: Number(draft.coupon_discount_value || 0),
        coupon_prefix: prefix,
        coupon_usage_limit: draft.coupon_usage_limit ?? null,
        coupon_valid_from: draft.coupon_valid_from ?? null,
        coupon_valid_until: draft.coupon_valid_until ?? null,
        coupon_freight_discount_value: draft.coupon_freight_discount_value ?? null,
        coupon_freight_valid_from: draft.coupon_freight_valid_from ?? null,
        coupon_freight_valid_until: draft.coupon_freight_valid_until ?? null,
        coupon_freight_usage_limit: draft.coupon_freight_usage_limit ?? null,
        coupon_pdf_enabled: draft.coupon_pdf_enabled !== false,
        coupon_freight_pdf_enabled: draft.coupon_freight_pdf_enabled !== false,
        coupon_li_category_ids: categoryIds,
        coupon_li_category_labels: categoryIds
          .map((id) => {
            const cat = categories.find((row) => row.id === id);
            if (!cat) return null;
            const parent = categories.find((row) => row.id === cat.parent_id);
            return parent ? `${parent.nome}: ${cat.nome}` : cat.nome;
          })
          .filter(Boolean),
      }).eq("id", table.id);

      // Os códigos dos cupons que vão ser regenerados saem da lista de conflitos,
      // senão o código nunca muda quando o prefixo ou o desconto são alterados.
      const regenerating = new Set(
        coupons
          .filter((coupon) => couponKind(coupon) === kind && selected.includes(coupon.team_member_id || ""))
          .map((coupon) => coupon.id),
      );
      const used = new Set(coupons.filter((coupon) => !regenerating.has(coupon.id)).map((coupon) => coupon.code));
      const rows: Record<string, unknown>[] = [];
      for (const id of selected) {
        const seller = sellers.find((row) => row.id === id);
        if (!seller) continue;
        const existing = coupons.find(
          (coupon) => coupon.team_member_id === id && couponKind(coupon) === kind,
        );
        // Padrão do código: iniciais do congresso + iniciais do vendedor + número do desconto (+ F no frete grátis).
        const base = `${prefix}${sellerInitials(seller.nome_completo)}${discountToken(value)}${isFreight ? "F" : ""}`;
        let code = base;
        let counter = 2;
        while (used.has(code)) { code = `${base}${counter}`; counter += 1; }
        used.add(code);
        rows.push({
          id: existing?.id,
          promotional_table_id: table.id,
          team_member_id: id,
          seller_name: seller.nome_completo,
          code,
          kind,
          free_shipping: isFreight,
          discount_type: discountType,
          discount_value: value,
          valid_from: validFrom,
          valid_until: validUntil,
          usage_limit: usageLimit,
          active: true,
          // Código alterado: precisa voltar para a loja com o novo código.
          ...(existing && existing.code !== code ? { li_synced_at: null, li_sync_error: null } : {}),
        });
      }
      const inserts = rows.filter((row) => !row.id).map(({ id: _id, ...row }) => row);
      const updates = rows.filter((row) => row.id);
      if (inserts.length) {
        const { error } = await supabase.from("promotional_coupons" as any).insert(inserts);
        if (error) throw error;
      }
      for (const row of updates) {
        const { id, ...patch } = row as Record<string, unknown> & { id: string };
        const { error } = await supabase.from("promotional_coupons" as any).update(patch).eq("id", id);
        if (error) throw error;
      }
      await loadCoupons();
      toast.success(isFreight ? "Cupons com frete grátis gerados/atualizados." : "Cupons gerados/atualizados.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar os cupons.");
    } finally {
      setBusy(null);
    }
  };

  const removeCoupon = async (coupon: PromotionalCoupon) => {
    if (!confirm(`Excluir o cupom ${coupon.code}?`)) return;
    const { error } = await supabase.from("promotional_coupons" as any).delete().eq("id", coupon.id);
    if (error) toast.error(error.message);
    else setCoupons((current) => current.filter((row) => row.id !== coupon.id));
  };

  const sendToLojaIntegrada = async () => {
    if (!coupons.length) { toast.error("Gere os cupons antes de enviar."); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-promo-coupons-sync", {
        body: { promotional_table_id: table.id },
      });
      if (error) throw error;
      const result = data as { sent?: number; failed?: number; results?: Array<{ code: string; error?: string }> };
      if (result?.failed) {
        const first = result.results?.find((row) => row.error);
        toast.error(`${result.failed} cupom(ns) não foram criados. ${first?.error || ""}`.trim());
      }
      if (result?.sent) toast.success(`${result.sent} cupom(ns) enviados para a Loja Integrada.`);
      await loadCoupons();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar para a Loja Integrada.");
    } finally {
      setSyncing(false);
    }
  };

  const shareText = (coupon: PromotionalCoupon) =>
    [
      `${draft.pdf_title || table.pdf_title} — Smart Dent`,
      couponKind(coupon) === "freight"
        ? "Frete grátis na compra online"
        : coupon.discount_type === "fixed"
          ? `Desconto de R$ ${Number(coupon.discount_value).toFixed(2).replace(".", ",")}`
          : `Desconto de ${Number(coupon.discount_value).toFixed(1).replace(".", ",")}%`,
      `Cupom: ${coupon.code}`,
      coupon.valid_until ? `Válido até ${new Date(`${coupon.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}` : null,
      "Use em loja.smartdent.com.br",
    ].filter(Boolean).join("\n");

  const discountCoupons = coupons.filter((coupon) => couponKind(coupon) === "discount");
  const freightCoupons = coupons.filter((coupon) => couponKind(coupon) === "freight");

  const renderCoupon = (coupon: PromotionalCoupon) => (
    <div key={coupon.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
      <div className="min-w-[160px] flex-1">
        <p className="font-semibold">{coupon.code}</p>
        <p className="text-xs text-muted-foreground">{coupon.seller_name || "—"}</p>
      </div>
      <span className="text-xs text-muted-foreground">
        {couponKind(coupon) === "freight"
          ? "Frete grátis"
          : coupon.discount_type === "fixed"
            ? `R$ ${Number(coupon.discount_value).toFixed(2).replace(".", ",")}`
            : `${Number(coupon.discount_value).toFixed(1).replace(".", ",")}%`}
      </span>
      {coupon.li_synced_at
        ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Na loja</Badge>
        : coupon.li_sync_error
          ? <Badge variant="destructive" title={coupon.li_sync_error}>Erro no envio</Badge>
          : <Badge variant="outline">Não enviado</Badge>}
      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareText(coupon)); toast.success("Mensagem copiada para o WhatsApp."); }}>
        <Copy className="mr-1 h-3.5 w-3.5" />Mensagem
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText(coupon))}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </Button>
      <Button size="icon" variant="ghost" title="Excluir cupom" onClick={() => removeCoupon(coupon)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );


  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4" />Cupons e vendedores autorizados</CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{coupons.length} cupom(ns)</Badge>
            <div className="flex items-center gap-2">
              <Switch id="coupon-pdf" checked={draft.coupon_pdf_enabled !== false}
                onCheckedChange={(value) => onDraftChange({ coupon_pdf_enabled: value })} />
              <Label htmlFor="coupon-pdf" className="text-xs font-normal">
                {draft.coupon_pdf_enabled !== false ? "Ativo no PDF" : "Não ativo"}
              </Label>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {sellerSource === "event"
            ? "Lista liberada no formulário deste evento."
            : "Nenhum formulário de evento associado — mostrando toda a equipe ativa."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Tipo de desconto</Label>
            <Select value={discountType} onValueChange={(value) => onDraftChange({ coupon_discount_type: value as "percent" | "fixed" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentual (%)</SelectItem>
                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor do desconto</Label>
            <Input type="number" min="0" step="0.01" value={draft.coupon_discount_value ?? 0}
              onChange={(e) => onDraftChange({ coupon_discount_value: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Início da promoção</Label>
            <Input type="date" value={draft.coupon_valid_from || ""}
              onChange={(e) => onDraftChange({ coupon_valid_from: e.target.value || null })} />
          </div>
          <div className="space-y-2">
            <Label>Fim da promoção</Label>
            <Input type="date" value={draft.coupon_valid_until || ""}
              onChange={(e) => onDraftChange({ coupon_valid_until: e.target.value || null })} />
          </div>
          <div className="space-y-2">
            <Label>Prefixo do código</Label>
            <Input value={draft.coupon_prefix || ""} placeholder={prefix}
              onChange={(e) => onDraftChange({ coupon_prefix: e.target.value || null })} />
          </div>
          <div className="space-y-2">
            <Label>Limite de usos por cupom</Label>
            <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
              Uso ilimitado até a data final
            </p>
          </div>

        </div>

        <div className="space-y-2">
          <Label>Vendedores autorizados</Label>
          {loading ? <p className="text-sm text-muted-foreground">Carregando equipe...</p> : (
            <div className="grid gap-2 grid-cols-2">
              {sellers.map((seller) => {
                const active = selected.includes(seller.id);
                return (
                  <button type="button" key={seller.id} onClick={() => toggleSeller(seller.id)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                    <Checkbox checked={active} className="pointer-events-none" />
                    <span className="truncate">{seller.nome_completo}</span>
                  </button>
                );
              })}
              {!sellers.length && <p className="text-sm text-muted-foreground">Nenhum vendedor ativo encontrado.</p>}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Categorias da loja onde o cupom vale</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline"
                onClick={() => onDraftChange({ coupon_li_category_ids: DEFAULT_CATEGORY_IDS })}>
                Seleção padrão
              </Button>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => onDraftChange({ coupon_li_category_ids: [] })}>
                Limpar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {categoryIds.length
              ? `${categoryIds.length} categoria(s) selecionada(s) — o desconto só vale nesses produtos.`
              : "Nenhuma categoria marcada: o cupom valerá para toda a loja."}
          </p>
          {loadingCats ? <p className="text-sm text-muted-foreground">Carregando categorias da loja...</p> : (
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border p-3">
              {categories.filter((cat) => !cat.parent_id).map((parent) => {
                const children = categories.filter((cat) => cat.parent_id === parent.id);
                if (!children.length) return null;
                return (
                  <div key={parent.id} className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{parent.nome}</p>
                    <div className="grid gap-2 grid-cols-2">
                      {children.map((child) => {
                        const active = categoryIds.includes(child.id);
                        return (
                          <button type="button" key={child.id} onClick={() => toggleCategory(child.id)}
                            className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                            <Checkbox checked={active} className="pointer-events-none" />
                            <span className="truncate">{child.nome}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!categories.length && <p className="text-sm text-muted-foreground">Nenhuma categoria retornada pela loja.</p>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => generateCoupons("discount")} disabled={!!busy}>
            {busy === "discount" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
            Gerar cupons dos vendedores
          </Button>
          <Button variant="outline" onClick={sendToLojaIntegrada} disabled={syncing || !coupons.length}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
            Enviar para a Loja Integrada
          </Button>
          <Button variant="ghost" onClick={loadCoupons}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>

        {discountCoupons.length > 0 && (
          <div className="space-y-2">{discountCoupons.map(renderCoupon)}</div>
        )}

        {/* ---- Segunda seção: cupons com frete grátis ---- */}
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4" />Cupons com desconto + frete grátis</p>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{freightCoupons.length} cupom(ns)</Badge>
              <div className="flex items-center gap-2">
                <Switch id="freight-pdf" checked={draft.coupon_freight_pdf_enabled !== false}
                  onCheckedChange={(value) => onDraftChange({ coupon_freight_pdf_enabled: value })} />
                <Label htmlFor="freight-pdf" className="text-xs font-normal">
                  {draft.coupon_freight_pdf_enabled !== false ? "Ativo no PDF" : "Não ativo"}
                </Label>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Para o cliente que esteve no congresso e o produto não estava disponível para entrega no local:
            ele compra online e não paga o frete. Cada vendedor recebe um segundo código terminado em "F",
            que pode ser usado junto com o cupom de desconto.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Desconto do cupom com frete</Label>
              <Input type="number" min="0" step="0.01"
                value={draft.coupon_freight_discount_value ?? draft.coupon_discount_value ?? 0}
                onChange={(e) => onDraftChange({ coupon_freight_discount_value: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={draft.coupon_freight_valid_from || ""}
                onChange={(e) => onDraftChange({ coupon_freight_valid_from: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={draft.coupon_freight_valid_until || ""}
                onChange={(e) => onDraftChange({ coupon_freight_valid_until: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label>Limite de usos por cupom</Label>
              <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                Uso ilimitado até a data final
              </p>
            </div>

          </div>
          <Button onClick={() => generateCoupons("freight")} disabled={!!busy}>
            {busy === "freight" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Gerar cupons com frete grátis
          </Button>
          {freightCoupons.length > 0 && (
            <div className="space-y-2">{freightCoupons.map(renderCoupon)}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

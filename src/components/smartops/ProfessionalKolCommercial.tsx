import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerInput } from "@/components/smartops/DatePickerInput";
import { Plus, Trash2, Ticket } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";
import ProfessionalKolPerformance from "./ProfessionalKolPerformance";
import { groupKolCatalogCategories } from "@/lib/kolPortfolioGroups";
import { isKolRowCustomized, kolRowKey, mapTemplateItems, ruleChannel, KOL_CHANNELS, type KolChannel, type KolDefaultRow } from "@/lib/kolCommissionDefaults";

export interface KolFormRef {
  id: string;
  name: string;
}

export interface KolCommissionRule {
  /** "category" = regra por categoria/subcategoria do portfólio; "referral" = comissão por indicação; ausente = produto específico. */
  kind?: "product" | "category" | "referral";
  /** Canal: indicacao | cupom | formulario (ausente = cupom). */
  channel?: KolChannel;
  category?: string | null;
  subcategory?: string | null;
  product_id: string;
  product_name: string;
  percent: number | null;
  /** Desconto do cupom da loja (%) — benefício ao cliente nos cupons desta categoria. */
  coupon_discount_percent?: number | null;
  active_from: string | null;
  source?: string;
}

export interface KolCoupon {
  code: string;
  active_from: string | null;
  active_to: string | null;
  /** % de comissão do profissional sobre as compras feitas com este cupom. */
  commission_percent?: number | null;
  category?: string | null;
  subcategory?: string | null;
}

interface Props {
  disabled?: boolean;
  formIds: KolFormRef[];
  onFormIdsChange: (v: KolFormRef[]) => void;
  coupons: KolCoupon[];
  onCouponsChange: (v: KolCoupon[]) => void;
  commissions: KolCommissionRule[];
  onCommissionsChange: (v: KolCommissionRule[]) => void;
}

interface FormOption { id: string; name: string }
interface ProductOption { id: string; name: string }

/** Bloco comercial do KOL: formulários de indicação, cupom da Loja Integrada e regras de comissionamento. */
export default function ProfessionalKolCommercial({
  disabled,
  formIds,
  onFormIdsChange,
  coupons,
  onCouponsChange,
  commissions,
  onCommissionsChange,
}: Props) {
  const [forms, setForms] = useState<FormOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [cats, setCats] = useState<{ cat: string; subs: string[] }[]>([]);
  const [defaults, setDefaults] = useState<Map<string, KolDefaultRow>>(new Map());
  const [pendingForm, setPendingForm] = useState<string>("");
  const [channel, setChannel] = useState<KolChannel>("indicacao");
  const channelInfo = KOL_CHANNELS.find((c) => c.id === channel)!;

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: p }] = await Promise.all([
        (supabase as any)
          .from("smartops_forms")
          .select("id, name")
          .order("name", { ascending: true })
          .limit(500),
        (supabase as any)
          .from("system_a_catalog")
          .select("id, name, category")
          .in("category", PRODUCT_CATALOG_ENTITY_TYPES as unknown as string[])
          .eq("active", true)
          .eq("approved", true)
          .order("name", { ascending: true })
          .limit(1000),
      ]);
      const { data: cr } = await (supabase as any)
        .from("system_a_catalog")
        .select("product_category, product_subcategory")
        .not("product_category", "is", null)
        .eq("active", true)
        .limit(2000);
      const m = new Map<string, Set<string>>();
      for (const x of (cr ?? []) as any[]) {
        const c = String(x.product_category).trim();
        if (!m.has(c)) m.set(c, new Set());
        if (x.product_subcategory) m.get(c)?.add(String(x.product_subcategory).trim());
      }
      setCats(
        Array.from(m.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
          .map(([cat, subs]) => ({ cat, subs: Array.from(subs).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })) })),
      );
      setForms(((f ?? []) as any[]).map((x) => ({ id: x.id, name: x.name ?? "(sem nome)" })));
      setProducts(((p ?? []) as any[]).map((x) => ({ id: x.id, name: x.name ?? "(sem nome)" })));
      const { data: items } = await (supabase as any)
        .from("kol_commission_template_items")
        .select("kind, channel, category, subcategory, product_id, percent, coupon_discount_percent, kol_commission_templates!inner(is_default)")
        .eq("kol_commission_templates.is_default", true);
      setDefaults(mapTemplateItems((items ?? []) as any[]));
    })();
  }, []);

  const availableForms = useMemo(
    () => forms.filter((f) => !formIds.some((s) => s.id === f.id)),
    [forms, formIds],
  );
  const portfolioGroups = useMemo(() => groupKolCatalogCategories(cats), [cats]);

  const addForm = () => {
    const f = forms.find((x) => x.id === pendingForm);
    if (!f) return;
    onFormIdsChange([...formIds, { id: f.id, name: f.name }]);
    setPendingForm("");
  };

  const addRule = () =>
    onCommissionsChange([...commissions, { product_id: "", product_name: "", percent: null, active_from: null }]);

  /** Editar % grava source='custom'; "Restaurar padrão" passa source='padrao' explicitamente. */
  const patchRule = (i: number, p: Partial<KolCommissionRule>) =>
    onCommissionsChange(commissions.map((r, idx) => {
      if (idx !== i) return r;
      const touchesPct = "percent" in p || "coupon_discount_percent" in p;
      return { ...r, ...(touchesPct && !p.source ? { source: "custom" } : {}), ...p };
    }));

  const isCat = (r: KolCommissionRule) => r.kind === "category";

  /** Regra única de comissão por indicação (leads dos formulários de indicação). */
  const referralIdx = commissions.findIndex((r) => r.kind === "referral");
  const referralRule = referralIdx !== -1 ? commissions[referralIdx] : null;
  const patchReferral = (percent: number | null) => {
    if (referralIdx !== -1) {
      patchRule(referralIdx, { percent });
    } else if (percent !== null) {
      onCommissionsChange([
        ...commissions,
        { kind: "referral", category: null, subcategory: null, product_id: "", product_name: "Comissão por indicação", percent, active_from: null },
      ]);
    }
  };
  const removeRule = (i: number) => onCommissionsChange(commissions.filter((_, idx) => idx !== i));

  /** Índice da regra de categoria/subcategoria existente (ou -1). */
  const catRuleIdx = (category: string, subcategory: string | null) =>
    commissions.findIndex((r) => isCat(r) && ruleChannel(r) === channel && r.category === category && (r.subcategory ?? null) === subcategory);

  /** Ativa/desativa uma combinação da lista pronta: cria ou remove a regra correspondente. */
  const toggleCatRule = (category: string, subcategory: string | null, on: boolean) => {
    const idx = catRuleIdx(category, subcategory);
    if (on && idx === -1) {
      onCommissionsChange([
        ...commissions,
        {
          kind: "category",
          channel,
          category,
          subcategory,
          product_id: "",
          product_name: subcategory ? `${category} › ${subcategory}` : category,
          percent: null,
          active_from: null,
        },
      ]);
    } else if (!on && idx !== -1) {
      removeRule(idx);
    }
  };

  const addCoupon = () => onCouponsChange([...coupons, { code: "", active_from: null, active_to: null, commission_percent: null }]);
  const patchCoupon = (i: number, p: Partial<KolCoupon>) =>
    onCouponsChange(coupons.map((c, idx) => (idx === i ? { ...c, ...p } : c)));
  const removeCoupon = (i: number) => onCouponsChange(coupons.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="w-5 h-5" /> KOL — indicações e comissionamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Formulários de indicação */}
        <div className="space-y-2">
          <Label>Formulários de indicação</Label>
          <p className="text-xs text-muted-foreground">
            Os leads que chegarem por estes formulários são contabilizados como indicação deste KOL.
          </p>
          {formIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {formIds.map((f) => (
                <Badge key={f.id} variant="secondary" className="gap-1">
                  {f.name}
                  {!disabled && (
                    <button
                      type="button"
                      className="hover:text-destructive"
                      onClick={() => onFormIdsChange(formIds.filter((x) => x.id !== f.id))}
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Select value={pendingForm} onValueChange={setPendingForm} disabled={disabled}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um formulário..." />
              </SelectTrigger>
              <SelectContent>
                {availableForms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addForm} disabled={disabled || !pendingForm}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Os percentuais destes formulários ficam em "Comissionamento por canal" abaixo (Formulários de indicação ou Formulários do profissional).
          </p>
        </div>

        {/* 2. Cupons Loja Integrada */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Cupons Loja Integrada</Label>
            <Button type="button" size="sm" variant="outline" onClick={addCoupon} disabled={disabled}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar cupom
            </Button>
          </div>
          {coupons.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum cupom cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {coupons.map((c, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_130px_40px] gap-2 items-end rounded-md border p-2">
                  <div>
                    <Label className="text-xs">Cupom</Label>
                    <Input
                      value={c.code}
                      onChange={(e) => patchCoupon(i, { code: e.target.value.toUpperCase() })}
                      disabled={disabled}
                      placeholder="EX: DRJOAO10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data de ativação</Label>
                    <DatePickerInput
                      value={c.active_from ?? undefined}
                      onChange={(v) => patchCoupon(i, { active_from: v })}
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data de fim</Label>
                    <DatePickerInput
                      value={c.active_to ?? undefined}
                      onChange={(v) => patchCoupon(i, { active_to: v })}
                      disabled={disabled}
                      className="w-full"
                      placeholder="Sem fim"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">% comissão KOL</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={c.commission_percent ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value)));
                        patchCoupon(i, { commission_percent: v });
                      }}
                      disabled={disabled}
                      placeholder="Ex: 5"
                    />
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeCoupon(i)} disabled={disabled}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Regras de comissionamento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Regras de comissionamento</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRule} disabled={disabled}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar regra
            </Button>
          </div>
          {commissions.filter((r) => !isCat(r) && r.kind !== "referral").length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma regra cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {commissions.map((r, i) => (isCat(r) || r.kind === "referral") ? null : (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_120px_180px_40px] gap-2 items-end rounded-md border p-2">
                  <div>
                    <Label className="text-xs">Produto</Label>
                    <Select
                      value={r.product_id}
                      onValueChange={(v) =>
                        patchRule(i, { product_id: v, product_name: products.find((p) => p.id === v)?.name ?? "" })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">% comissão</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={r.percent ?? ""}
                      onChange={(e) => patchRule(i, { percent: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data de ativação</Label>
                    <DatePickerInput
                      value={r.active_from ?? undefined}
                      onChange={(v) => patchRule(i, { active_from: v })}
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRule(i)}
                    disabled={disabled}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Comissionamento por categoria / subcategoria do portfólio — lista pronta */}
        <div className="space-y-2">
          <Label>Comissionamento por canal, categoria e subcategoria</Label>
          <div className="flex flex-wrap gap-2">
            {KOL_CHANNELS.map((c) => (
              <Button key={c.id} type="button" size="sm" variant={channel === c.id ? "default" : "outline"} onClick={() => setChannel(c.id)}>
                {c.label}
              </Button>
            ))}
          </div>
          <p className="text-xs font-medium text-foreground">{channelInfo.description}</p>
          <p className="text-xs text-muted-foreground">
            Todas as categorias e subcategorias do portfólio já estão listadas abaixo: ative as que remuneram este KOL e
            informe o percentual (e, se quiser, a data de ativação). Regra de produto específico tem prioridade, depois
            subcategoria, depois categoria.
          </p>
          {cats.length === 0 ? (
            <p className="text-xs text-muted-foreground">Carregando categorias do portfólio...</p>
          ) : (
            <div className="space-y-5">
              {portfolioGroups.map((group) => (
                <section key={group.label} className="space-y-2">
                  <h3 className="border-b pb-2 text-sm font-semibold text-foreground">{group.label}</h3>
                  {group.categories.length === 0 && <p className="text-xs text-muted-foreground">Sem categorias cadastradas nesta etapa.</p>}
                  {group.categories.flatMap((c) => {
                const rows: { category: string; subcategory: string | null; label: string; isSub: boolean }[] = [
                  { category: c.cat, subcategory: null, label: c.cat, isSub: false },
                  ...c.subs.map((s) => ({ category: c.cat, subcategory: s as string | null, label: s, isSub: true })),
                ];
                return rows.map((row) => {
                  const idx = catRuleIdx(row.category, row.subcategory);
                  const rule = idx !== -1 ? commissions[idx] : null;
                  const active = idx !== -1;
                  const def = defaults.get(kolRowKey({ kind: "category", channel, category: row.category, subcategory: row.subcategory, product_id: "" }));
                  const custom = !!rule && isKolRowCustomized(rule, def);
                  const clamp = (v: string) => (v === "" ? null : Math.min(100, Math.max(0, parseFloat(v))));
                  return (
                    <div
                      key={`${row.category}::${row.subcategory ?? "*"}`}
                      className={`grid grid-cols-1 md:grid-cols-[1fr_100px_110px_160px_150px] gap-2 items-center rounded-md border p-2 ${
                        active ? "" : "opacity-60"
                      } ${row.isSub ? "md:ml-6" : "bg-muted/40"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={active}
                          onCheckedChange={(on) => toggleCatRule(row.category, row.subcategory, on)}
                          disabled={disabled}
                        />
                        <span className={`text-sm ${row.isSub ? "" : "font-medium"}`}>
                          {row.isSub ? row.label : `${row.label} (todas as subcategorias)`}
                        </span>
                        {custom && <Badge variant="outline" className="text-[10px]">personalizado</Badge>}
                      </div>
                      <Input
                        type="number" min={0} max={100} step="0.1"
                        value={rule?.percent ?? ""}
                        onChange={(e) => idx !== -1 && patchRule(idx, { percent: clamp(e.target.value) })}
                        disabled={disabled || !active}
                        placeholder="KOL %"
                        title="Comissão do KOL (%)"
                      />
                      {channelInfo.hasDiscount ? <Input
                        type="number" min={0} max={100} step="0.1"
                        value={rule?.coupon_discount_percent ?? ""}
                        onChange={(e) => idx !== -1 && patchRule(idx, { coupon_discount_percent: clamp(e.target.value) })}
                        disabled={disabled || !active}
                        placeholder="Cupom %"
                        title="Desconto do cupom da loja (%)"
                      /> : <span className="text-xs text-muted-foreground">sem cupom</span>}
                      <DatePickerInput
                        value={rule?.active_from ?? undefined}
                        onChange={(v) => idx !== -1 && patchRule(idx, { active_from: v })}
                        disabled={disabled || !active}
                        className="w-full"
                        placeholder="Ativação"
                      />
                      <div className="text-right">
                        {custom && def && (
                          <Button type="button" size="sm" variant="ghost" disabled={disabled}
                            onClick={() => patchRule(idx, { percent: def.percent, coupon_discount_percent: def.coupon_discount_percent })}>
                            Restaurar padrão
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                });
                  })}
                </section>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    <ProfessionalKolPerformance formIds={formIds} coupons={coupons} commissions={commissions} />
    </div>
  );
}

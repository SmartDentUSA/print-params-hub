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

export interface KolFormRef {
  id: string;
  name: string;
}

export interface KolCommissionRule {
  /** "category" = regra por categoria/subcategoria do portfólio; ausente = produto específico. */
  kind?: "product" | "category";
  category?: string | null;
  subcategory?: string | null;
  product_id: string;
  product_name: string;
  percent: number | null;
  active_from: string | null;
}

export interface KolCoupon {
  code: string;
  active_from: string | null;
  active_to: string | null;
  /** % de comissão do profissional sobre as compras feitas com este cupom. */
  commission_percent?: number | null;
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
  const [pendingForm, setPendingForm] = useState<string>("");

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
        if (x.product_subcategory) m.get(c)!.add(String(x.product_subcategory).trim());
      }
      setCats(
        Array.from(m.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
          .map(([cat, subs]) => ({ cat, subs: Array.from(subs).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })) })),
      );
      setForms(((f ?? []) as any[]).map((x) => ({ id: x.id, name: x.name ?? "(sem nome)" })));
      setProducts(((p ?? []) as any[]).map((x) => ({ id: x.id, name: x.name ?? "(sem nome)" })));
    })();
  }, []);

  const availableForms = useMemo(
    () => forms.filter((f) => !formIds.some((s) => s.id === f.id)),
    [forms, formIds],
  );

  const addForm = () => {
    const f = forms.find((x) => x.id === pendingForm);
    if (!f) return;
    onFormIdsChange([...formIds, { id: f.id, name: f.name }]);
    setPendingForm("");
  };

  const addRule = () =>
    onCommissionsChange([...commissions, { product_id: "", product_name: "", percent: null, active_from: null }]);

  const patchRule = (i: number, p: Partial<KolCommissionRule>) =>
    onCommissionsChange(commissions.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const isCat = (r: KolCommissionRule) => r.kind === "category";
  const removeRule = (i: number) => onCommissionsChange(commissions.filter((_, idx) => idx !== i));

  /** Índice da regra de categoria/subcategoria existente (ou -1). */
  const catRuleIdx = (category: string, subcategory: string | null) =>
    commissions.findIndex((r) => isCat(r) && r.category === category && (r.subcategory ?? null) === subcategory);

  /** Ativa/desativa uma combinação da lista pronta: cria ou remove a regra correspondente. */
  const toggleCatRule = (category: string, subcategory: string | null, on: boolean) => {
    const idx = catRuleIdx(category, subcategory);
    if (on && idx === -1) {
      onCommissionsChange([
        ...commissions,
        {
          kind: "category",
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
          {commissions.filter((r) => !isCat(r)).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma regra cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {commissions.map((r, i) => isCat(r) ? null : (
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
          <Label>Comissionamento por categoria e subcategoria</Label>
          <p className="text-xs text-muted-foreground">
            Todas as categorias e subcategorias do portfólio já estão listadas abaixo: ative as que remuneram este KOL e
            informe o percentual (e, se quiser, a data de ativação). Regra de produto específico tem prioridade, depois
            subcategoria, depois categoria.
          </p>
          {cats.length === 0 ? (
            <p className="text-xs text-muted-foreground">Carregando categorias do portfólio...</p>
          ) : (
            <div className="space-y-1">
              {cats.flatMap((c) => {
                const rows: { category: string; subcategory: string | null; label: string; isSub: boolean }[] = [
                  { category: c.cat, subcategory: null, label: c.cat, isSub: false },
                  ...c.subs.map((s) => ({ category: c.cat, subcategory: s as string | null, label: s, isSub: true })),
                ];
                return rows.map((row) => {
                  const idx = catRuleIdx(row.category, row.subcategory);
                  const rule = idx !== -1 ? commissions[idx] : null;
                  const active = idx !== -1;
                  return (
                    <div
                      key={`${row.category}::${row.subcategory ?? "*"}`}
                      className={`grid grid-cols-1 md:grid-cols-[1fr_120px_180px_60px] gap-2 items-center rounded-md border p-2 ${
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
                      </div>
                      <div>
                        <Input
                          type="number" min={0} max={100} step="0.1"
                          value={rule?.percent ?? ""}
                          onChange={(e) =>
                            idx !== -1 &&
                            patchRule(idx, { percent: e.target.value === "" ? null : Math.min(100, Math.max(0, parseFloat(e.target.value))) })
                          }
                          disabled={disabled || !active}
                          placeholder="%"
                        />
                      </div>
                      <div>
                        <DatePickerInput
                          value={rule?.active_from ?? undefined}
                          onChange={(v) => idx !== -1 && patchRule(idx, { active_from: v })}
                          disabled={disabled || !active}
                          className="w-full"
                          placeholder="Ativação"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-right">{active ? "Ativa" : ""}</div>
                    </div>
                  );
                });
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    <ProfessionalKolPerformance formIds={formIds} coupons={coupons} commissions={commissions} />
    </div>
  );
}

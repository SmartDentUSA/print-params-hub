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
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";

export interface KolFormRef {
  id: string;
  name: string;
}

export interface KolCommissionRule {
  product_id: string;
  product_name: string;
  percent: number | null;
  active_from: string | null;
}

interface Props {
  disabled?: boolean;
  formIds: KolFormRef[];
  onFormIdsChange: (v: KolFormRef[]) => void;
  coupon: string;
  onCouponChange: (v: string) => void;
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
  coupon,
  onCouponChange,
  commissions,
  onCommissionsChange,
}: Props) {
  const [forms, setForms] = useState<FormOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
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
          .select("id, name, entity_type")
          .in("entity_type", PRODUCT_CATALOG_ENTITY_TYPES as unknown as string[])
          .eq("active", true)
          .order("name", { ascending: true })
          .limit(1000),
      ]);
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

  const removeRule = (i: number) => onCommissionsChange(commissions.filter((_, idx) => idx !== i));

  return (
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

        {/* 2. Cupom Loja Integrada */}
        <div className="max-w-xs">
          <Label>Cupom Loja Integrada</Label>
          <Input
            value={coupon}
            onChange={(e) => onCouponChange(e.target.value.toUpperCase())}
            disabled={disabled}
            placeholder="EX: DRJOAO10"
          />
        </div>

        {/* 3. Regras de comissionamento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Regras de comissionamento</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRule} disabled={disabled}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar regra
            </Button>
          </div>
          {commissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma regra cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {commissions.map((r, i) => (
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
      </CardContent>
    </Card>
  );
}

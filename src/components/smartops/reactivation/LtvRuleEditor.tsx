import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { PipelineSelect, StageSelect, LossReasonSelect } from "./common/PiperunSelect";
import { SellerSelect, SellerMultiSelect } from "./common/SellerSelect";

export interface LtvRule {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  trigger_days_list: number[];
  source_pipeline_id: string | null;
  target_pipeline_id: string | null;
  target_stage_id: string | null;
  lost_pipeline_id: string | null;
  loss_reason_id: string | null;
  seller_strategy: "original" | "round_robin" | "fixed";
  fixed_seller_id: string | null;
  round_robin_seller_ids: string[];
  deal_title_template: string;
  deal_origin_tag_template: string;
  product_suggestion_source: "last_deal" | "category" | "manual";
  product_category: string | null;
  notify_seller: boolean;
  waleads_message: string | null;
  min_ltv: number;
  max_open_ltv_deals: number;
  cooldown_days: number;
  dry_run: boolean;
  priority: number;
}

const empty = (): LtvRule => ({
  id: "",
  name: "",
  description: "",
  active: true,
  trigger_days_list: [30, 60, 120],
  source_pipeline_id: null,
  target_pipeline_id: null,
  target_stage_id: null,
  lost_pipeline_id: null,
  loss_reason_id: null,
  seller_strategy: "original",
  fixed_seller_id: null,
  round_robin_seller_ids: [],
  deal_title_template: "LTV {days}d — {person_name}",
  deal_origin_tag_template: "#LTV-Ativo-{days}",
  product_suggestion_source: "last_deal",
  product_category: null,
  notify_seller: false,
  waleads_message: "",
  min_ltv: 0,
  max_open_ltv_deals: 1,
  cooldown_days: 30,
  dry_run: false,
  priority: 100,
});

export function LtvRuleEditor({
  rule, open, onClose, onSaved,
}: {
  rule: LtvRule | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<LtvRule>(empty());
  const [saving, setSaving] = useState(false);
  const [newDay, setNewDay] = useState<string>("");

  useEffect(() => {
    setForm(rule ? { ...empty(), ...rule } : empty());
  }, [rule, open]);

  const update = <K extends keyof LtvRule>(key: K, value: LtvRule[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addDay = () => {
    const n = Number(newDay);
    if (!Number.isFinite(n) || n <= 0) return;
    if (form.trigger_days_list.includes(n)) return;
    update("trigger_days_list", [...form.trigger_days_list, n].sort((a, b) => a - b));
    setNewDay("");
  };
  const removeDay = (d: number) => update("trigger_days_list", form.trigger_days_list.filter((x) => x !== d));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe um nome");
    if (!form.target_pipeline_id) return toast.error("Selecione o pipeline destino (LTV)");
    if (form.trigger_days_list.length === 0) return toast.error("Adicione ao menos uma cadência");

    setSaving(true);
    const payload: any = { ...form };
    if (!payload.id) delete payload.id;

    const q = form.id
      ? supabase.from("ltv_reactivation_rules").update(payload).eq("id", form.id)
      : supabase.from("ltv_reactivation_rules").insert(payload);

    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Regra atualizada" : "Regra criada");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar regra LTV" : "Nova regra LTV"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.active} onCheckedChange={(v) => update("active", v)} />
              <Label>Ativa</Label>
              <div className="mx-3 h-6 border-l" />
              <Switch checked={form.dry_run} onCheckedChange={(v) => update("dry_run", v)} />
              <Label>Dry-run</Label>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pipeline origem (CS)</Label>
              <PipelineSelect value={form.source_pipeline_id} onChange={(v) => update("source_pipeline_id", v)} />
            </div>
            <div>
              <Label>Pipeline destino (LTV)</Label>
              <PipelineSelect value={form.target_pipeline_id} onChange={(v) => { update("target_pipeline_id", v); update("target_stage_id", null); }} />
            </div>
            <div>
              <Label>Etapa inicial no LTV</Label>
              <StageSelect pipelineId={form.target_pipeline_id} value={form.target_stage_id} onChange={(v) => update("target_stage_id", v)} />
            </div>
            <div>
              <Label>Pipeline LTV Perdidos</Label>
              <PipelineSelect value={form.lost_pipeline_id} onChange={(v) => update("lost_pipeline_id", v)} />
            </div>
            <div>
              <Label>Motivo de perda (LTV)</Label>
              <LossReasonSelect value={form.loss_reason_id} onChange={(v) => update("loss_reason_id", v)} />
            </div>
          </div>

          <div>
            <Label>Cadências (dias após ganho em VENDAS)</Label>
            <div className="flex flex-wrap gap-2 items-center mt-1">
              {form.trigger_days_list.map((d) => (
                <Badge key={d} variant="secondary" className="gap-1">
                  D+{d}
                  <button onClick={() => removeDay(d)} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  type="number" min={1} value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDay())}
                  className="w-20 h-8" placeholder="30"
                />
                <Button size="sm" variant="outline" onClick={addDay}><Plus className="w-3 h-3" /></Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estratégia de vendedor</Label>
              <Select value={form.seller_strategy} onValueChange={(v) => update("seller_strategy", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original (vendedor do deal ganho)</SelectItem>
                  <SelectItem value="round_robin">Round-robin</SelectItem>
                  <SelectItem value="fixed">Vendedor fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.seller_strategy === "fixed" && (
              <div>
                <Label>Vendedor fixo</Label>
                <SellerSelect value={form.fixed_seller_id} onChange={(v) => update("fixed_seller_id", v)} />
              </div>
            )}
          </div>

          {form.seller_strategy === "round_robin" && (
            <div>
              <Label>Vendedores no round-robin</Label>
              <SellerMultiSelect value={form.round_robin_seller_ids ?? []} onChange={(v) => update("round_robin_seller_ids", v)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Template do título do deal</Label>
              <Input value={form.deal_title_template} onChange={(e) => update("deal_title_template", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Placeholders: <code>{"{days}"}</code>, <code>{"{person_name}"}</code></p>
            </div>
            <div>
              <Label>Tag de origem</Label>
              <Input value={form.deal_origin_tag_template} onChange={(e) => update("deal_origin_tag_template", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Preview: <span className="font-mono">{form.deal_origin_tag_template.replace("{days}", "30")}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sugestão de produto</Label>
              <Select value={form.product_suggestion_source} onValueChange={(v) => update("product_suggestion_source", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_deal">Último produto comprado</SelectItem>
                  <SelectItem value="category">Por categoria</SelectItem>
                  <SelectItem value="manual">Manual (definir na regra)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.product_suggestion_source === "category" && (
              <div>
                <Label>Categoria</Label>
                <Input value={form.product_category ?? ""} onChange={(e) => update("product_category", e.target.value)} placeholder="ex: resina" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Min LTV (R$)</Label>
              <Input type="number" value={form.min_ltv} onChange={(e) => update("min_ltv", Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Max deals LTV abertos</Label>
              <Input type="number" value={form.max_open_ltv_deals} onChange={(e) => update("max_open_ltv_deals", Number(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Cooldown (dias)</Label>
              <Input type="number" value={form.cooldown_days} onChange={(e) => update("cooldown_days", Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.notify_seller} onCheckedChange={(v) => update("notify_seller", v)} />
            <Label>Notificar vendedor via WhatsApp</Label>
          </div>

          {form.notify_seller && (
            <div>
              <Label>Mensagem WhatsApp</Label>
              <Textarea value={form.waleads_message ?? ""} onChange={(e) => update("waleads_message", e.target.value)} rows={3}
                placeholder="Olá {seller_name}, seu cliente {person_name} completou {days} dias de compra…" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LtvRuleEditor, type LtvRule } from "./LtvRuleEditor";

export function LtvRules() {
  const [rules, setRules] = useState<LtvRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LtvRule | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ltv_reactivation_rules")
      .select("*")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(`Erro ao carregar regras: ${error.message}`);
    setRules((data ?? []) as any as LtvRule[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (rule: LtvRule) => {
    const { error } = await supabase
      .from("ltv_reactivation_rules")
      .update({ active: !rule.active })
      .eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success(rule.active ? "Regra desativada" : "Regra ativada");
    load();
  };

  const remove = async (rule: LtvRule) => {
    if (!confirm(`Excluir regra "${rule.name}"?`)) return;
    const { error } = await supabase.from("ltv_reactivation_rules").delete().eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success("Regra excluída");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Regras de Reativação LTV</h3>
          <p className="text-sm text-muted-foreground">
            Abre um novo deal no funil LTV D+30/60/120 após ganho no funil VENDAS, sem tocar no card de CS.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova regra
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma regra criada. Clique em <strong>Nova regra</strong> para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{r.name}</CardTitle>
                    <Badge variant={r.active ? "default" : "outline"}>
                      {r.active ? "Ativa" : "Inativa"}
                    </Badge>
                    {r.dry_run && <Badge variant="secondary">Dry-run</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                    <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(r)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-muted-foreground text-xs">Cadências:</span>
                  {(r.trigger_days_list ?? []).map((d) => (
                    <Badge key={d} variant="outline">D+{d}</Badge>
                  ))}
                </div>
                <div className="text-muted-foreground text-xs">
                  Estratégia: <span className="text-foreground">{r.seller_strategy}</span>
                  {" · "}Tag: <span className="text-foreground font-mono">{r.deal_origin_tag_template}</span>
                  {" · "}Cooldown: <span className="text-foreground">{r.cooldown_days}d</span>
                </div>
                {r.description && <div className="text-muted-foreground text-xs">{r.description}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <LtvRuleEditor
          rule={editing}
          open={creating || !!editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
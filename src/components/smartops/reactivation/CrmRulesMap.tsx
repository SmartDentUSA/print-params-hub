import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const flows = [
  { name: "Pessoa / Empresa / Deal", edge: "smart-ops-lia-assign", tables: ["lia_attendances", "deals", "team_members"], guards: ["golden_rule", "commercial_intent", "person_origin_frozen", "cognitive_lock"] },
  { name: "Nota unificada de vendedor", edge: "smart-ops-lia-assign", tables: ["smartops_deal_note_locks"], guards: ["seller_note_slot_lock"] },
  { name: "Reativação LTV (novo)", edge: "smart-ops-ltv-reactivation", tables: ["ltv_reactivation_rules", "ltv_reactivation_runs", "deals"], guards: ["golden_rule", "dedupe", "cooldown"] },
  { name: "Régua CS pós-venda", edge: "smart-ops-cs-processor", tables: ["cs_automation_rules", "cs_onboarding_mover_queue"], guards: ["schedule_window"] },
  { name: "Webhook PipeRun (status/stage)", edge: "smart-ops-piperun-webhook", tables: ["piperun_webhook_events", "deals", "piperun_stage_transitions"], guards: ["dedupe_event"] },
];

export function CrmRulesMap() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const tables = ["reactivation_rules", "cs_automation_rules", "ltv_reactivation_rules"] as const;
      const out: Record<string, number> = {};
      for (const t of tables) {
        const { count } = await supabase.from(t).select("id", { count: "exact", head: true });
        out[t] = count ?? 0;
      }
      setCounts(out);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Mapa de Regras CRM</h3>
        <p className="text-sm text-muted-foreground">
          Todos os fluxos que criam ou atualizam deals no PipeRun.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {flows.map((f) => (
          <Card key={f.name}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{f.name}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div><span className="text-muted-foreground">Edge:</span> <code className="text-xs">{f.edge}</code></div>
              <div>
                <span className="text-muted-foreground text-xs">Tabelas: </span>
                {f.tables.map((t) => <Badge key={t} variant="outline" className="mr-1 text-xs">{t}</Badge>)}
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Guards: </span>
                {f.guards.map((g) => <Badge key={g} variant="secondary" className="mr-1 text-xs">{g}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Tabelas de regras existentes</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-3 gap-3">
          <div><span className="text-muted-foreground">reactivation_rules (D0/D3/D7):</span> <strong>{counts.reactivation_rules ?? "—"}</strong></div>
          <div><span className="text-muted-foreground">cs_automation_rules (régua CS):</span> <strong>{counts.cs_automation_rules ?? "—"}</strong></div>
          <div><span className="text-muted-foreground">ltv_reactivation_rules (novo):</span> <strong>{counts.ltv_reactivation_rules ?? "—"}</strong></div>
        </CardContent>
      </Card>
    </div>
  );
}
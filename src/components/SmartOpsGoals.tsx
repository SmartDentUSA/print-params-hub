import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GoalsData {
  mql: number;
  sql: number;
  vendas: number;
  csContratos: number;
  csOnboarding: number;
  csOngoing: number;
  pipelineMeta: number;
}

export const DEFAULT_GOALS: GoalsData = {
  mql: 100,
  sql: 40,
  vendas: 15,
  csContratos: 10,
  csOnboarding: 8,
  csOngoing: 5,
  pipelineMeta: 50,
};

const KEYS_MAP: Record<keyof GoalsData, string> = {
  mql: "smartops_goal_mql",
  sql: "smartops_goal_sql",
  vendas: "smartops_goal_vendas",
  csContratos: "smartops_goal_cs_contratos",
  csOnboarding: "smartops_goal_cs_onboarding",
  csOngoing: "smartops_goal_cs_ongoing",
  pipelineMeta: "smartops_goal_pipeline_meta",
};

const LABELS: Record<keyof GoalsData, string> = {
  mql: "Meta MQL (Novos)",
  sql: "Meta SQL (Qualificados)",
  vendas: "Meta Vendas",
  csContratos: "Meta CS Contratos",
  csOnboarding: "Meta CS Onboarding",
  csOngoing: "Meta CS Ongoing",
  pipelineMeta: "Meta Pipeline (mensal)",
};

export async function fetchGoals(): Promise<GoalsData> {
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", "smartops_goal_%");

  const goals = { ...DEFAULT_GOALS };
  if (data) {
    const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
    for (const [field, dbKey] of Object.entries(KEYS_MAP)) {
      if (map[dbKey]) {
        (goals as unknown as Record<string, number>)[field] = parseInt(map[dbKey], 10) || (DEFAULT_GOALS as unknown as Record<string, number>)[field];
      }
    }
  }
  return goals;
}

export function SmartOpsGoalsButton({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GoalsData>(DEFAULT_GOALS);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchGoals().then(setForm);
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const entries = Object.entries(KEYS_MAP).map(([field, dbKey]) => ({
      key: dbKey,
      value: String((form as unknown as Record<string, number>)[field]),
    }));

    for (const entry of entries) {
      await supabase.from("site_settings").upsert(entry, { onConflict: "key" });
    }

    setSaving(false);
    setOpen(false);
    toast({ title: "Metas atualizadas" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-1" /> Metas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Metas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(Object.keys(LABELS) as (keyof GoalsData)[]).map((field) => (
            <div key={field} className="flex items-center gap-3">
              <Label className="w-48 text-sm">{LABELS[field]}</Label>
              <Input
                type="number"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: parseInt(e.target.value, 10) || 0 })}
                className="w-24"
              />
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar Metas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

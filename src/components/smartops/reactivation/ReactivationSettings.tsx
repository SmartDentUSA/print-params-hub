import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { PipelineSelect, StageSelect } from "./common/PiperunSelect";

interface Settings {
  id: string;
  piperun_cs_pipeline_id: string | null;
  piperun_vendas_pipeline_id: string | null;
  piperun_ltv_pipeline_id: string | null;
  piperun_ltv_stage_id: string | null;
  piperun_ltv_lost_pipeline_id: string | null;
  default_trigger_days: number[];
  default_seller_strategy: string;
  default_cooldown_days: number;
  ltv_cron_hour: number;
  ltv_cron_minute: number;
  rollout_mode: string;
  shadow_duration_days: number;
  guard_golden_rule: boolean;
  guard_commercial_intent: boolean;
  guard_person_origin_frozen: boolean;
  guard_dedupe: boolean;
  commercial_intent_whitelist: string[];
}

export function ReactivationSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [newDay, setNewDay] = useState("");
  const [newSource, setNewSource] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("operational_settings").select("*").eq("singleton", true).maybeSingle();
    setS(data as any);
  };
  useEffect(() => { load(); }, []);

  if (!s) return <p className="text-muted-foreground">Carregando configurações…</p>;

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("operational_settings").update({
      piperun_cs_pipeline_id: s.piperun_cs_pipeline_id,
      piperun_vendas_pipeline_id: s.piperun_vendas_pipeline_id,
      piperun_ltv_pipeline_id: s.piperun_ltv_pipeline_id,
      piperun_ltv_stage_id: s.piperun_ltv_stage_id,
      piperun_ltv_lost_pipeline_id: s.piperun_ltv_lost_pipeline_id,
      default_trigger_days: s.default_trigger_days,
      default_seller_strategy: s.default_seller_strategy,
      default_cooldown_days: s.default_cooldown_days,
      ltv_cron_hour: s.ltv_cron_hour,
      ltv_cron_minute: s.ltv_cron_minute,
      rollout_mode: s.rollout_mode,
      shadow_duration_days: s.shadow_duration_days,
      guard_golden_rule: s.guard_golden_rule,
      guard_commercial_intent: s.guard_commercial_intent,
      guard_person_origin_frozen: s.guard_person_origin_frozen,
      guard_dedupe: s.guard_dedupe,
      commercial_intent_whitelist: s.commercial_intent_whitelist,
    }).eq("id", s.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Pipelines PipeRun (default)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label>Pipeline VENDAS</Label>
            <PipelineSelect value={s.piperun_vendas_pipeline_id} onChange={(v) => update("piperun_vendas_pipeline_id", v)} />
          </div>
          <div>
            <Label>Pipeline CS</Label>
            <PipelineSelect value={s.piperun_cs_pipeline_id} onChange={(v) => update("piperun_cs_pipeline_id", v)} />
          </div>
          <div>
            <Label>Pipeline LTV</Label>
            <PipelineSelect value={s.piperun_ltv_pipeline_id} onChange={(v) => { update("piperun_ltv_pipeline_id", v); update("piperun_ltv_stage_id", null); }} />
          </div>
          <div>
            <Label>Etapa inicial LTV</Label>
            <StageSelect pipelineId={s.piperun_ltv_pipeline_id} value={s.piperun_ltv_stage_id} onChange={(v) => update("piperun_ltv_stage_id", v)} />
          </div>
          <div>
            <Label>Pipeline LTV Perdidos</Label>
            <PipelineSelect value={s.piperun_ltv_lost_pipeline_id} onChange={(v) => update("piperun_ltv_lost_pipeline_id", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Defaults de reativação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Cadências default</Label>
            <div className="flex flex-wrap gap-2 items-center mt-1">
              {s.default_trigger_days.map((d) => (
                <Badge key={d} variant="secondary" className="gap-1">
                  D+{d}
                  <button onClick={() => update("default_trigger_days", s.default_trigger_days.filter((x) => x !== d))} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Input type="number" value={newDay} onChange={(e) => setNewDay(e.target.value)} className="w-20 h-8" placeholder="90" />
              <Button size="sm" variant="outline" onClick={() => {
                const n = Number(newDay);
                if (n > 0 && !s.default_trigger_days.includes(n)) {
                  update("default_trigger_days", [...s.default_trigger_days, n].sort((a, b) => a - b));
                  setNewDay("");
                }
              }}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Estratégia default</Label>
              <Select value={s.default_seller_strategy} onValueChange={(v) => update("default_seller_strategy", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  <SelectItem value="round_robin">Round-robin</SelectItem>
                  <SelectItem value="fixed">Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cooldown default (dias)</Label>
              <Input type="number" value={s.default_cooldown_days} onChange={(e) => update("default_cooldown_days", Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Horário do cron (HH:MM)</Label>
              <div className="flex gap-2">
                <Input type="number" min={0} max={23} value={s.ltv_cron_hour} onChange={(e) => update("ltv_cron_hour", Number(e.target.value) || 0)} />
                <Input type="number" min={0} max={59} value={s.ltv_cron_minute} onChange={(e) => update("ltv_cron_minute", Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rollout de fluxos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label>Modo</Label>
            <Select value={s.rollout_mode} onValueChange={(v) => update("rollout_mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direto (substitui hardcoded ao publicar)</SelectItem>
                <SelectItem value="shadow">Shadow (roda em paralelo antes de promover)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duração do shadow (dias)</Label>
            <Input type="number" value={s.shadow_duration_days} onChange={(e) => update("shadow_duration_days", Number(e.target.value) || 0)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Guards fixos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {([
            ["guard_golden_rule", "Golden Rule — não sobrescrever deal aberto em VENDAS"],
            ["guard_commercial_intent", "Commercial Intent — só cria deal para sources whitelistadas"],
            ["guard_person_origin_frozen", "Person Origin Frozen — não sobrescrever origem no primeiro contato"],
            ["guard_dedupe", "Dedupe — impede criar dois deals para o mesmo evento"],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <Switch checked={(s as any)[key]} onCheckedChange={(v) => update(key as keyof Settings, v as any)} />
              <span className="text-sm">{label}</span>
            </div>
          ))}
          <div className="pt-3">
            <Label>Whitelist commercial intent (sources)</Label>
            <div className="flex flex-wrap gap-2 items-center mt-1">
              {(s.commercial_intent_whitelist ?? []).map((src) => (
                <Badge key={src} variant="secondary" className="gap-1">
                  {src}
                  <button onClick={() => update("commercial_intent_whitelist", s.commercial_intent_whitelist.filter((x) => x !== src))}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Input value={newSource} onChange={(e) => setNewSource(e.target.value)} className="w-40 h-8" placeholder="ex: formulario_sdr" />
              <Button size="sm" variant="outline" onClick={() => {
                if (newSource && !s.commercial_intent_whitelist.includes(newSource)) {
                  update("commercial_intent_whitelist", [...s.commercial_intent_whitelist, newSource]);
                  setNewSource("");
                }
              }}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</Button>
      </div>
    </div>
  );
}
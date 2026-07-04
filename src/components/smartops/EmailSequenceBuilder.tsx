import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Save, ListPlus } from "lucide-react";

interface Seed {
  produto_id: string;
  audience_filter: Record<string, unknown>;
  subject: string;
  preheader: string;
  html: string;
  cta_config: any;
  cta_button_label: string;
  tom: string;
  campaign_name: string;
}

interface Step {
  step_order: number;
  delay_days: number;
  send_hour: number;
  subject_template: string;
  preheader_template: string;
  html_template: string;
  cta_button_label: string;
  cta_config: any;
  tom: string;
}

interface Props {
  seedFromCurrent: Seed;
  onBack: () => void;
}

export function EmailSequenceBuilder({ seedFromCurrent, onBack }: Props) {
  const [name, setName] = useState(`Régua — ${seedFromCurrent.campaign_name || "sem nome"}`);
  const [description, setDescription] = useState("");
  const [stopCondition, setStopCondition] = useState<"clicked" | "opened" | "deal_won" | "none">("clicked");
  const [saving, setSaving] = useState(false);

  const [steps, setSteps] = useState<Step[]>([
    {
      step_order: 1, delay_days: 0, send_hour: 9,
      subject_template: seedFromCurrent.subject,
      preheader_template: seedFromCurrent.preheader,
      html_template: seedFromCurrent.html,
      cta_button_label: seedFromCurrent.cta_button_label,
      cta_config: seedFromCurrent.cta_config,
      tom: seedFromCurrent.tom,
    },
  ]);

  useEffect(() => {
    // reset first step from seed when seed changes (e.g., different campaign)
    setSteps(prev => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      return [{ ...first,
        subject_template: first.subject_template || seedFromCurrent.subject,
        preheader_template: first.preheader_template || seedFromCurrent.preheader,
        html_template: first.html_template || seedFromCurrent.html,
      }, ...rest];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedFromCurrent.subject, seedFromCurrent.html]);

  function addStep() {
    setSteps(prev => [...prev, {
      step_order: prev.length + 1,
      delay_days: (prev[prev.length - 1]?.delay_days || 0) + 3,
      send_hour: 9,
      subject_template: "",
      preheader_template: "",
      html_template: "",
      cta_button_label: seedFromCurrent.cta_button_label,
      cta_config: seedFromCurrent.cta_config,
      tom: seedFromCurrent.tom,
    }]);
  }

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_order: idx + 1 })));
  }

  async function handleSave(activate: boolean) {
    if (!name.trim()) return toast.error("Dê um nome à régua");
    if (!steps.length) return toast.error("Adicione ao menos 1 disparo");
    if (steps.some(s => !s.subject_template || !s.html_template)) {
      return toast.error("Todo disparo precisa de assunto e HTML");
    }
    setSaving(true);
    try {
      const { data: seq, error: seqErr } = await (supabase as any)
        .from("email_sequences").insert({
          name, description,
          produto_id: seedFromCurrent.produto_id || null,
          audience_filter: seedFromCurrent.audience_filter,
          stop_condition: stopCondition,
          status: activate ? "active" : "draft",
          activated_at: activate ? new Date().toISOString() : null,
        }).select("id").single();
      if (seqErr) throw seqErr;

      const rows = steps.map(s => ({
        sequence_id: seq.id,
        step_order: s.step_order,
        delay_days: s.delay_days,
        send_hour: s.send_hour,
        subject_template: s.subject_template,
        preheader_template: s.preheader_template,
        html_template: s.html_template,
        cta_button_label: s.cta_button_label,
        cta_config: s.cta_config,
        tom: s.tom,
      }));
      const { error: stepsErr } = await (supabase as any).from("email_sequence_steps").insert(rows);
      if (stepsErr) throw stepsErr;

      toast.success(activate ? "Régua ativada! Cron horária vai começar a disparar." : "Régua salva como rascunho.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListPlus className="w-4 h-4" /> 5. Criar régua automática (opcional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs bg-primary/5 border border-primary/20 rounded p-3">
          💡 Transforme este email em uma sequência automática. Cada lead da audiência recebe os disparos
          em ordem, respeitando os dias de espera. A régua para automaticamente na condição escolhida.
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nome da régua</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Condição de parada</Label>
            <Select value={stopCondition} onValueChange={v => setStopCondition(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clicked">Parar quando clicar no CTA</SelectItem>
                <SelectItem value="opened">Parar quando abrir o email</SelectItem>
                <SelectItem value="deal_won">Parar quando virar Deal ganho</SelectItem>
                <SelectItem value="none">Nunca parar (dispara todos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Descrição interna (opcional)</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Reativação de leads frios pós-Feira" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Disparos ({steps.length})</Label>
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar disparo
            </Button>
          </div>

          {steps.map((s, i) => (
            <div key={i} className="border rounded p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  Disparo #{s.step_order}
                  {s.delay_days === 0 ? " · imediato" : ` · +${s.delay_days} dia${s.delay_days > 1 ? "s" : ""}`}
                  {` · ${String(s.send_hour).padStart(2, "0")}:00`}
                </Badge>
                {steps.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => removeStep(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-[10px]">Dias de espera</Label>
                  <Input type="number" min={0} value={s.delay_days}
                    onChange={e => updateStep(i, { delay_days: Math.max(0, +e.target.value || 0) })} />
                </div>
                <div>
                  <Label className="text-[10px]">Hora do envio</Label>
                  <Input type="number" min={0} max={23} value={s.send_hour}
                    onChange={e => updateStep(i, { send_hour: Math.min(23, Math.max(0, +e.target.value || 0)) })} />
                </div>
                <div>
                  <Label className="text-[10px]">Tom</Label>
                  <Input value={s.tom} onChange={e => updateStep(i, { tom: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-[10px]">Assunto</Label>
                <Input value={s.subject_template}
                  onChange={e => updateStep(i, { subject_template: e.target.value })}
                  placeholder={i === 0 ? "(usa o assunto atual)" : "Assunto deste disparo"} />
              </div>
              <div>
                <Label className="text-[10px]">HTML (mesmos placeholders {"{{nome}}"}, {"{{link_wa_vendedor}}"})</Label>
                <textarea value={s.html_template}
                  onChange={e => updateStep(i, { html_template: e.target.value })}
                  className="w-full font-mono text-xs h-24 border rounded p-2"
                  placeholder={i === 0 ? "(usa o HTML atual)" : "HTML deste disparo"} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-2 border-t">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> Salvar rascunho
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              <ListPlus className="w-4 h-4 mr-1" /> {saving ? "Salvando…" : "Ativar régua"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

type Setting = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  function_name: string | null;
  ativo: boolean;
  wa_instance_name: string | null;
  message_template: string | null;
  variaveis: string[] | null;
};

// Texto padrão de cada automação, apenas informativo (a função usa este texto
// quando o modelo abaixo está vazio).
const DEFAULT_HINT: Record<string, string> = {
  stripe_payment_notice: "Aviso de pagamento com cliente, produto, valor, hora e vendedor.",
  technical_ticket: "Chamado técnico completo: cliente, equipamentos, compras, diagnóstico e histórico.",
  lia_escalation: "Aviso de escalação da LIA com o resumo do lead e o motivo do handoff.",
  sentinela_daily_report: "Resumo Sentinela 24h: volume de mensagens, sentimento, sinais de compra e tópicos.",
  training_factory_publish: "Aviso de publicação dos assets da turma (canais e status).",
  course_enrollment_confirmation:
    "Confirmação com curso, turma, instrutor, local, cronograma e link da live/grupo. O modelo do curso (editor de cursos) tem prioridade sobre este.",
  course_reminder_1h:
    "Lembrete 1h antes com curso, horário e link da live/grupo. O modelo do curso tem prioridade sobre este.",
  course_nps_whatsapp:
    "Convite de NPS com link exclusivo do participante. O modelo do curso tem prioridade sobre este.",
  course_nps_sms_followup:
    "SMS curto (até 160 caracteres) com link encurtado do NPS. O modelo do curso tem prioridade sobre este.",
};

const cleanVar = (v: string) => v.replace(/[{}]/g, "").trim();

export function WaAutomationSettings() {
  const [rows, setRows] = useState<Setting[]>([]);
  const [instances, setInstances] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: settings, error }, { data: members }] = await Promise.all([
        supabase
          .from("wa_automation_settings")
          .select("id, slug, nome, descricao, function_name, ativo, wa_instance_name, message_template, variaveis")
          .order("nome"),
        supabase
          .from("team_members")
          .select("evolution_instance_name")
          .eq("ativo", true)
          .not("evolution_instance_name", "is", null),
      ]);
      if (error) toast.error("Falha ao carregar configurações de automação");
      setRows(((settings ?? []) as unknown as Setting[]).map((r) => ({ ...r, variaveis: (r.variaveis as unknown as string[]) ?? [] })));
      const names = Array.from(
        new Set(((members ?? []) as { evolution_instance_name: string | null }[]).map((m) => m.evolution_instance_name).filter(Boolean) as string[]),
      ).sort();
      setInstances(names);
      setLoading(false);
    })();
  }, []);

  const patch = (slug: string, changes: Partial<Setting>) =>
    setRows((prev) => prev.map((r) => (r.slug === slug ? { ...r, ...changes } : r)));

  const save = async (row: Setting) => {
    setSaving(row.slug);
    const { error } = await supabase
      .from("wa_automation_settings")
      .update({
        ativo: row.ativo,
        wa_instance_name: row.wa_instance_name?.trim() || null,
        message_template: row.message_template?.trim() || null,
      })
      .eq("id", row.id);
    setSaving(null);
    if (error) toast.error(`Falha ao salvar: ${error.message}`);
    else toast.success(`${row.nome} atualizada`);
  };

  const insertVar = (row: Setting, v: string) =>
    patch(row.slug, { message_template: `${row.message_template ?? ""}{{${cleanVar(v)}}}` });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Automações sem UI — instância e texto
        </CardTitle>
        <CardDescription>
          Liga/desliga, instância de envio e modelo de mensagem das automações que antes eram fixas no código.
          Deixe o modelo vazio para usar o texto padrão da função.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma automação configurável encontrada.</p>
        ) : (
          rows.map((row) => (
            <div key={row.slug} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.nome}</p>
                    <Badge variant="outline" className="font-mono text-[10px]">{row.function_name ?? row.slug}</Badge>
                    <Badge
                      variant="outline"
                      className={row.ativo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}
                    >
                      {row.ativo ? "ativa" : "desligada"}
                    </Badge>
                  </div>
                  {row.descricao && <p className="text-xs text-muted-foreground mt-1">{row.descricao}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label htmlFor={`sw-${row.slug}`} className="text-xs text-muted-foreground">Ativa</Label>
                  <Switch
                    id={`sw-${row.slug}`}
                    checked={row.ativo}
                    onCheckedChange={(v) => patch(row.slug, { ativo: v })}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Instância de envio</Label>
                  <Select
                    value={row.wa_instance_name ?? "__default__"}
                    onValueChange={(v) => patch(row.slug, { wa_instance_name: v === "__default__" ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Padrão da função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Padrão da função</SelectItem>
                      {instances.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Modelo de mensagem</Label>
                  <Textarea
                    rows={4}
                    value={row.message_template ?? ""}
                    placeholder="Vazio = texto padrão da função"
                    onChange={(e) => patch(row.slug, { message_template: e.target.value })}
                    className="font-mono text-xs"
                  />
                  {DEFAULT_HINT[row.slug] && (
                    <p className="text-[11px] text-muted-foreground">
                      Padrão da função: {DEFAULT_HINT[row.slug]}
                    </p>
                  )}
                  {(row.variaveis?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {row.variaveis!.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVar(row, v)}
                          className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] hover:bg-accent"
                        >
                          {`{{${cleanVar(v)}}}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(row)} disabled={saving === row.slug}>
                  {saving === row.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="ml-2">Salvar</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

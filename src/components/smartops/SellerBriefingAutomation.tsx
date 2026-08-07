import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Trash2, UserRoundCheck } from "lucide-react";
import { WaLeadsVariableBar } from "@/components/smartops/WaLeadsVariableBar";

interface BriefingConfig {
  id: string;
  ativo: boolean;
  canal: string;
  sender_instance: string;
  quando: string;
  delay_minutos: number;
  horario_inicio: string;
  horario_fim: string;
  usar_template_padrao: boolean;
  mensagem_template: string | null;
  incluir_link_wa: boolean;
  link_wa_mensagem: string;
  purge_enabled: boolean;
  purge_hora: number;
  purge_idade_horas: number;
  purge_last_run_at: string | null;
}

export function SellerBriefingAutomation() {
  const [cfg, setCfg] = useState<BriefingConfig | null>(null);
  const [instances, setInstances] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: members }] = await Promise.all([
        supabase.from("seller_briefing_config").select("*").limit(1).maybeSingle(),
        supabase
          .from("team_members")
          .select("evolution_instance_name")
          .not("evolution_instance_name", "is", null),
      ]);
      if (error) toast.error("Erro ao carregar configuração do briefing");
      if (data) setCfg(data as unknown as BriefingConfig);
      const uniq = Array.from(
        new Set((members ?? []).map((m: any) => m.evolution_instance_name).filter(Boolean)),
      ) as string[];
      if (!uniq.includes("smartdent_marketing")) uniq.unshift("smartdent_marketing");
      setInstances(uniq.sort());
      setLoading(false);
    })();
  }, []);

  const patch = (p: Partial<BriefingConfig>) => setCfg((c) => (c ? { ...c, ...p } : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { id, purge_last_run_at, ...rest } = cfg as BriefingConfig & Record<string, unknown>;
    // remove campos gerenciados pelo banco para evitar erro de update
    delete (rest as Record<string, unknown>).created_at;
    delete (rest as Record<string, unknown>).updated_at;
    delete (rest as Record<string, unknown>).singleton;
    const { error } = await supabase
      .from("seller_briefing_config")
      .update(rest as never)
      .eq("id", id);
    setSaving(false);
    if (error) toast.error(`Falha ao salvar configuração: ${error.message}`);
    else toast.success("Configuração salva");
  };

  const runPurge = async () => {
    setPurging(true);
    const { data, error } = await supabase.functions.invoke("smart-ops-wa-purge-briefings", {
      body: { force: true },
    });
    setPurging(false);
    if (error) toast.error("Falha ao limpar mensagens");
    else
      toast.success(
        `Limpeza concluída — ${data?.deleted ?? 0} apagadas${data?.failed ? `, ${data.failed} falhas` : ""}`,
      );
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração do briefing...
        </CardContent>
      </Card>
    );
  }

  if (!cfg) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <UserRoundCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Briefing de novos leads ao vendedor</h3>
            <p className="text-xs text-muted-foreground">
              Disparo automático do briefing SmartOps para o vendedor responsável
            </p>
          </div>
          <Badge variant={cfg.ativo ? "secondary" : "outline"} className="ml-2">
            {cfg.ativo ? "ativa" : "inativa"}
          </Badge>
        </div>
        <Switch checked={cfg.ativo} onCheckedChange={(v) => patch({ ativo: v })} />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* O QUE / QUANDO / COMO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              O quê (canal)
            </Label>
            <Select value={cfg.canal} onValueChange={(v) => patch({ canal: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quando</Label>
            <Select value={cfg.quando} onValueChange={(v) => patch({ quando: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead_atribuido">Ao atribuir o lead ao vendedor</SelectItem>
                <SelectItem value="lead_criado">Assim que o lead é criado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Como (instância ativa de envio)
            </Label>
            <Select
              value={cfg.sender_instance}
              onValueChange={(v) => patch({ sender_instance: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {instances.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Atraso (minutos)</Label>
            <Input
              type="number"
              min={0}
              value={cfg.delay_minutos}
              onChange={(e) => patch({ delay_minutos: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Janela — início</Label>
            <Input
              type="time"
              value={(cfg.horario_inicio ?? "00:00").slice(0, 5)}
              onChange={(e) => patch({ horario_inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Janela — fim</Label>
            <Input
              type="time"
              value={(cfg.horario_fim ?? "23:59").slice(0, 5)}
              onChange={(e) => patch({ horario_fim: e.target.value })}
            />
          </div>
        </div>

        {/* MENSAGEM */}
        {cfg.canal === "whatsapp" && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Usar mensagem padrão do sistema</Label>
                <p className="text-xs text-muted-foreground">
                  Briefing “📊 Análise SmartOps” gerado automaticamente com o histórico do lead
                </p>
              </div>
              <Switch
                checked={cfg.usar_template_padrao}
                onCheckedChange={(v) => patch({ usar_template_padrao: v })}
              />
            </div>

            {!cfg.usar_template_padrao && (
              <div className="space-y-2">
                <Label className="text-xs">Mensagem personalizada</Label>
                <WaLeadsVariableBar
                  onInsert={(k) =>
                    patch({ mensagem_template: `${cfg.mensagem_template ?? ""}{{${k}}}` })
                  }
                />
                <Textarea
                  rows={6}
                  placeholder="Ex: 🚀 Novo lead: {{nome}} — {{produto_interesse}} ({{cidade}}/{{uf}})"
                  value={cfg.mensagem_template ?? ""}
                  onChange={(e) => patch({ mensagem_template: e.target.value })}
                />
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label className="text-sm font-medium">Incluir link do WhatsApp do lead</Label>
                <p className="text-xs text-muted-foreground">
                  Botão wa.me com a mensagem pronta para o vendedor abrir a conversa
                </p>
              </div>
              <Switch
                checked={cfg.incluir_link_wa}
                onCheckedChange={(v) => patch({ incluir_link_wa: v })}
              />
            </div>

            {cfg.incluir_link_wa && (
              <div className="space-y-2">
                <Label className="text-xs">Mensagem pré-preenchida no link</Label>
                <WaLeadsVariableBar
                  onInsert={(k) =>
                    patch({ link_wa_mensagem: `${cfg.link_wa_mensagem ?? ""}{{${k}}}` })
                  }
                />
                <Textarea
                  rows={3}
                  value={cfg.link_wa_mensagem ?? ""}
                  onChange={(e) => patch({ link_wa_mensagem: e.target.value })}
                />
              </div>
            )}
          </div>
        )}

        {cfg.canal !== "whatsapp" && (
          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            Canal <strong>{cfg.canal}</strong> selecionado: o envio por WhatsApp fica suspenso e o
            briefing não é disparado até que o canal volte para WhatsApp.
          </div>
        )}

        {/* LIMPEZA */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Apagar todas as mensagens enviadas
              </Label>
              <p className="text-xs text-muted-foreground">
                Apaga no WhatsApp do vendedor os briefings já enviados, mantendo a lista limpa
              </p>
            </div>
            <Switch
              checked={cfg.purge_enabled}
              onCheckedChange={(v) => patch({ purge_enabled: v })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Hora da limpeza</Label>
              <Input
                type="time"
                step={3600}
                value={`${String(cfg.purge_hora ?? 6).padStart(2, "0")}:00`}
                onChange={(e) => {
                  const h = Number((e.target.value || "06:00").split(":")[0]);
                  patch({ purge_hora: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 6 });
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Qualquer horário (hora cheia, fuso São Paulo)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Apagar mensagens com mais de (horas)</Label>
              <Input
                type="number"
                min={1}
                value={cfg.purge_idade_horas}
                onChange={(e) => patch({ purge_idade_horas: Number(e.target.value) || 24 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Última execução</Label>
              <div className="text-xs text-muted-foreground py-2">
                {cfg.purge_last_run_at
                  ? new Date(cfg.purge_last_run_at).toLocaleString("pt-BR")
                  : "nunca"}
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={runPurge} disabled={purging}>
            {purging ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-1" />
            )}
            Limpar agora
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

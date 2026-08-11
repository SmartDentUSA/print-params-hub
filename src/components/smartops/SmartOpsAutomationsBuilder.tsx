import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Save, Send, Trash2, Workflow } from "lucide-react";
import { MessageVariableBar } from "@/components/smartops/MessageVariableBar";

interface Automation {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  canal: string;
  quando: string;
  gate_pipeline_id: string | null;
  gate_pipeline_name: string | null;
  gate_stage_ids: string[];
  gate_stage_names: string[];
  sender_instance: string;
  destinatario: string;
  destino_numero: string | null;
  delay_minutos: number;
  horario_inicio: string;
  horario_fim: string;
  mensagem_template: string | null;
  mensagem_fora_horario: string | null;
  cooldown_horas: number;
  email_assunto: string | null;
  email_html: string | null;
  email_remetente: string | null;
  sms_template: string | null;
}

interface CrmOption {
  id: string;
  name: string;
}

const CANAIS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "sms", label: "SMS" },
];

const QUANDO = [
  { value: "etapa_alterada", label: "Quando o lead entra na etapa" },
  { value: "lead_atribuido", label: "Ao atribuir o lead ao vendedor" },
  { value: "lead_criado", label: "Assim que o lead é criado" },
];

export function SmartOpsAutomationsBuilder() {
  const [rows, setRows] = useState<Automation[]>([]);
  const [instances, setInstances] = useState<string[]>([]);
  const [pipelines, setPipelines] = useState<CrmOption[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, CrmOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testFor, setTestFor] = useState<Automation | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testCanais, setTestCanais] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: members }, pipes] = await Promise.all([
        supabase.from("smartops_automations").select("*").order("created_at"),
        supabase.from("team_members").select("evolution_instance_name").not("evolution_instance_name", "is", null),
        supabase.functions.invoke("piperun-list-pipelines", { body: { resource: "pipelines" } }),
      ]);
      if (error) toast.error("Erro ao carregar automações");
      setRows((data ?? []) as unknown as Automation[]);
      const uniq = Array.from(new Set((members ?? []).map((m: any) => m.evolution_instance_name).filter(Boolean))) as string[];
      if (!uniq.includes("smartdent_marketing")) uniq.unshift("smartdent_marketing");
      setInstances(uniq.sort());
      setPipelines((((pipes as any)?.data?.items ?? []) as any[]).map((i) => ({ id: String(i.id), name: i.name })));
      setLoading(false);
    })();
  }, []);

  const loadStages = async (pipelineId: string) => {
    if (stagesByPipeline[pipelineId]) return;
    const { data } = await supabase.functions.invoke("piperun-list-pipelines", {
      body: { resource: "stages", pipeline_id: pipelineId },
    });
    setStagesByPipeline((s) => ({
      ...s,
      [pipelineId]: (((data as any)?.items ?? []) as any[]).map((i) => ({ id: String(i.id), name: i.name })),
    }));
  };

  useEffect(() => {
    rows.forEach((r) => { if (r.gate_pipeline_id) loadStages(r.gate_pipeline_id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.gate_pipeline_id).join("|")]);

  const patch = (id: string, p: Partial<Automation>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const addNew = async () => {
    const { data, error } = await supabase
      .from("smartops_automations")
      .insert({ nome: "Nova automação", descricao: "Descreva o objetivo desta automação" } as never)
      .select("*")
      .maybeSingle();
    if (error || !data) return toast.error(`Falha ao criar automação: ${error?.message}`);
    setRows((rs) => [...rs, data as unknown as Automation]);
    toast.success("Automação criada — configure e salve");
  };

  const save = async (a: Automation) => {
    setBusyId(a.id);
    const { id, ...rest } = a;
    const { error } = await supabase.from("smartops_automations").update(rest as never).eq("id", id);
    setBusyId(null);
    if (error) toast.error(`Falha ao salvar: ${error.message}`);
    else toast.success("Automação salva");
  };

  const remove = async (a: Automation) => {
    const { error } = await supabase.from("smartops_automations").delete().eq("id", a.id);
    if (error) return toast.error(`Falha ao excluir: ${error.message}`);
    setRows((rs) => rs.filter((r) => r.id !== a.id));
    toast.success("Automação excluída");
  };

  const openTest = (a: Automation) => {
    const canais = String(a.canal ?? "").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
    setTestFor(a);
    setTestCanais(canais);
  };

  const runTest = async () => {
    const a = testFor;
    if (!a) return;
    if (testCanais.length === 0) return toast.error("Selecione ao menos um canal para o teste");
    const needPhone = testCanais.some((c) => c === "whatsapp" || c === "sms");
    if (needPhone && !testPhone.trim()) return toast.error("Informe o número para WhatsApp/SMS");
    if (testCanais.includes("email") && !testEmail.trim()) return toast.error("Informe o e-mail de teste");
    setBusyId(a.id);
    const { data, error } = await supabase.functions.invoke("smart-ops-automations-run", {
      body: {
        automation_id: a.id,
        test_canais: testCanais,
        test_phone: needPhone ? testPhone.trim() : null,
        test_email: testCanais.includes("email") ? testEmail.trim() : null,
      },
    });
    setBusyId(null);
    if (error) return toast.error(`Falha no envio de teste: ${error.message}`);
    const results = (data?.results ?? []) as any[];
    if (results.length === 0) return toast.error("Nada enviado — verifique canais e mensagens da automação");
    results.forEach((r) => {
      const label = String(r.canal ?? "").toUpperCase();
      if (r.ok) toast.success(`${label} enviado — ${r.run_uid ?? "teste"}`);
      else toast.error(`${label} não enviado: ${r.error ?? r.skipped ?? "erro desconhecido"}`);
    });
    if (results.every((r) => r.ok)) setTestFor(null);
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando automações...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Automações SmartOps</h3>
          <p className="text-xs text-muted-foreground">
            Monte automações por funil e etapa do CRM — o quê, quando, como, atraso e mensagem com variáveis.
            Todo envio recebe um identificador único e entra na Timeline do Lead.
          </p>
        </div>
        <Button onClick={addNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Adicionar nova automação
        </Button>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground text-center">
            Nenhuma automação criada. Clique em “Adicionar nova automação”.
          </CardContent>
        </Card>
      )}

      {rows.map((a) => {
        const canais = String(a.canal ?? "").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
        const hasCanal = (c: string) => canais.includes(c);
        const toggleCanal = (c: string, on: boolean) => {
          const next = on ? Array.from(new Set([...canais, c])) : canais.filter((x) => x !== c);
          patch(a.id, { canal: next.join(",") });
        };
        const stages = a.gate_pipeline_id ? (stagesByPipeline[a.gate_pipeline_id] ?? []) : [];
        const stageIds = a.gate_stage_ids ?? [];
        const toggleStage = (s: CrmOption, on: boolean) => {
          const ids = on ? Array.from(new Set([...stageIds, s.id])) : stageIds.filter((x) => x !== s.id);
          patch(a.id, {
            gate_stage_ids: ids,
            gate_stage_names: stages.filter((st) => ids.includes(st.id)).map((st) => st.name),
          });
        };

        return (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="flex items-center gap-2 flex-1">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Workflow className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    value={a.nome}
                    onChange={(e) => patch(a.id, { nome: e.target.value })}
                    className="h-8 font-semibold"
                  />
                  <Input
                    value={a.descricao ?? ""}
                    placeholder="Descrição da automação"
                    onChange={(e) => patch(a.id, { descricao: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <Badge variant={a.ativo ? "secondary" : "outline"}>{a.ativo ? "ativa" : "inativa"}</Badge>
              </div>
              <Switch checked={a.ativo} onCheckedChange={(v) => patch(a.id, { ativo: v })} />
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">O quê (canais)</Label>
                  <div className="rounded-md border divide-y">
                    {CANAIS.map((c) => (
                      <div key={c.key} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm">{c.label}</span>
                        <Switch checked={hasCanal(c.key)} onCheckedChange={(v) => toggleCanal(c.key, v)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quando</Label>
                  <Select value={a.quando} onValueChange={(v) => patch(a.id, { quando: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUANDO.map((q) => (
                        <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs">Destinatário</Label>
                  <Select value={a.destinatario} onValueChange={(v) => patch(a.id, { destinatario: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="vendedor">Vendedor responsável</SelectItem>
                      <SelectItem value="numero_fixo">Número fixo</SelectItem>
                    </SelectContent>
                  </Select>
                  {a.destinatario === "numero_fixo" && (
                    <Input
                      placeholder="5519999999999"
                      value={a.destino_numero ?? ""}
                      onChange={(e) => patch(a.id, { destino_numero: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Funil do CRM</Label>
                  <Select
                    value={a.gate_pipeline_id ?? ""}
                    onValueChange={(v) => {
                      const p = pipelines.find((x) => x.id === v);
                      loadStages(v);
                      patch(a.id, {
                        gate_pipeline_id: v,
                        gate_pipeline_name: p?.name ?? null,
                        gate_stage_ids: [],
                        gate_stage_names: [],
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Etapas</Label>
                  <ScrollArea className="h-[132px] rounded-md border">
                    <div className="divide-y">
                      {stages.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {a.gate_pipeline_id ? "Carregando etapas..." : "Selecione um funil primeiro"}
                        </p>
                      )}
                      {stages.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                          <Checkbox checked={stageIds.includes(s.id)} onCheckedChange={(v) => toggleStage(s, v === true)} />
                          <span className="truncate">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  {(a.gate_stage_names ?? []).length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      Ativas: {(a.gate_stage_names ?? []).join(", ")}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Como (instância de envio)
                  </Label>
                  <Select value={a.sender_instance} onValueChange={(v) => patch(a.id, { sender_instance: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {instances.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs">Atraso (minutos)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={a.delay_minutos}
                    onChange={(e) => patch(a.id, { delay_minutos: Number(e.target.value) || 0 })}
                  />
                  <Label className="text-xs">Cooldown por lead (horas)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={a.cooldown_horas}
                    onChange={(e) => patch(a.id, { cooldown_horas: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Janela — início</Label>
                  <Input
                    type="time"
                    value={String(a.horario_inicio ?? "08:00").slice(0, 5)}
                    onChange={(e) => patch(a.id, { horario_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Janela — fim</Label>
                  <Input
                    type="time"
                    value={String(a.horario_fim ?? "20:00").slice(0, 5)}
                    onChange={(e) => patch(a.id, { horario_fim: e.target.value })}
                  />
                </div>
              </div>

              {/* CONSTRUTOR DE MENSAGEM */}
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label className="text-xs">Mensagem WhatsApp (dentro da janela)</Label>
                  <MessageVariableBar
                    onInsert={(k) => patch(a.id, { mensagem_template: `${a.mensagem_template ?? ""}{{${k}}}` })}
                  />
                  <Textarea
                    rows={6}
                    placeholder="Ex: Olá {{primeiro_nome}}, sobre {{produto_interesse}}..."
                    value={a.mensagem_template ?? ""}
                    onChange={(e) => patch(a.id, { mensagem_template: e.target.value })}
                  />
                </div>
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-xs">Mensagem fora do horário (opcional)</Label>
                  <MessageVariableBar
                    onInsert={(k) => patch(a.id, { mensagem_fora_horario: `${a.mensagem_fora_horario ?? ""}{{${k}}}` })}
                  />
                  <Textarea
                    rows={4}
                    value={a.mensagem_fora_horario ?? ""}
                    onChange={(e) => patch(a.id, { mensagem_fora_horario: e.target.value })}
                  />
                </div>

                {hasCanal("sms") && (
                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-xs">
                      Mensagem SMS (máx. 160 caracteres) — {String(a.sms_template ?? "").length}/160
                    </Label>
                    <MessageVariableBar
                      onInsert={(k) => patch(a.id, { sms_template: `${a.sms_template ?? ""}{{${k}}}` })}
                    />
                    <Textarea
                      rows={3}
                      maxLength={160}
                      placeholder="Ex: {{primeiro_nome}}, a Smart Dent tem novidades sobre {{produto_interesse}}."
                      value={a.sms_template ?? ""}
                      onChange={(e) => patch(a.id, { sms_template: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Sem mensagem SMS própria, o motor usa a mensagem do WhatsApp cortada em 160 caracteres.
                    </p>
                  </div>
                )}

                {hasCanal("email") && (
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Editor de e-mail</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Assunto</Label>
                        <Input
                          placeholder="Ex: {{primeiro_nome}}, sobre {{produto_interesse}}"
                          value={a.email_assunto ?? ""}
                          onChange={(e) => patch(a.id, { email_assunto: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Remetente</Label>
                        <Input
                          placeholder="Smart Dent | Fluxo Digital"
                          value={a.email_remetente ?? ""}
                          onChange={(e) => patch(a.id, { email_remetente: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Corpo do e-mail (HTML)</Label>
                      <MessageVariableBar
                        onInsert={(k) => patch(a.id, { email_html: `${a.email_html ?? ""}{{${k}}}` })}
                      />
                      <Textarea
                        rows={10}
                        className="font-mono text-xs"
                        placeholder={'<p>Olá {{primeiro_nome}},</p>\n<p>Sobre {{produto_interesse}}...</p>'}
                        value={a.email_html ?? ""}
                        onChange={(e) => patch(a.id, { email_html: e.target.value })}
                      />
                    </div>
                    {(a.email_html ?? "").trim() && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Pré-visualização</Label>
                        <div
                          className="rounded-md border bg-background p-3 text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: a.email_html ?? "" }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => remove(a)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openTest(a)} disabled={busyId === a.id}>
                    <Send className="w-4 h-4 mr-1" /> Enviar teste
                  </Button>
                  <Button size="sm" onClick={() => save(a)} disabled={busyId === a.id}>
                    {busyId === a.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!testFor} onOpenChange={(o) => !o && setTestFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar teste — {testFor?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Canais do teste</Label>
              <div className="rounded-md border divide-y">
                {CANAIS.filter((c) =>
                  String(testFor?.canal ?? "").split(",").map((x) => x.trim().toLowerCase()).includes(c.key),
                ).map((c) => (
                  <label key={c.key} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={testCanais.includes(c.key)}
                      onCheckedChange={(v) =>
                        setTestCanais((s) => (v === true ? Array.from(new Set([...s, c.key])) : s.filter((x) => x !== c.key)))
                      }
                    />
                    {c.label}
                  </label>
                ))}
                {String(testFor?.canal ?? "").trim() === "" && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum canal ativado nesta automação — ative WhatsApp, E-mail ou SMS e salve.
                  </p>
                )}
              </div>
            </div>
            {testCanais.some((c) => c === "whatsapp" || c === "sms") && (
              <div className="space-y-1.5">
                <Label className="text-xs">Número (WhatsApp / SMS)</Label>
                <Input placeholder="5519999999999" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
              </div>
            )}
            {testCanais.includes("email") && (
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail de teste</Label>
                <Input
                  type="email"
                  placeholder="voce@smartdent.com.br"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              O teste usa o último lead atualizado para preencher as variáveis. Salve a automação antes de testar.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestFor(null)}>Cancelar</Button>
            <Button onClick={runTest} disabled={busyId === testFor?.id}>
              {busyId === testFor?.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Enviar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

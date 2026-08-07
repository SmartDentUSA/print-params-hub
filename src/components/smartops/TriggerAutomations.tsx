import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Play,
  Send,
  Mail,
  MessageSquare,
  Smartphone,
  Instagram,
  Facebook,
  Music2,
  ShieldCheck,
} from "lucide-react";

type TriggerSource = "email" | "whatsapp" | "instagram" | "facebook" | "tiktok";
type TriggerEvent = "opened" | "clicked" | "replied" | "message_received";
type ActionType = "sms" | "email" | "whatsapp";

interface TriggerAutomation {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  prioridade: number;
  trigger_source: TriggerSource;
  trigger_event: TriggerEvent;
  trigger_config: Record<string, unknown>;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  instance_name: string | null;
  horario_inicio: number;
  horario_fim: number;
  dias_semana: number[];
  delay_minutos: number;
  cooldown_horas: number;
  dedupe_window_minutes: number;
  max_por_dia: number;
  last_run_at: string | null;
}

const SOURCES: { value: TriggerSource; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "email", label: "E-mail", icon: Mail },
  { value: "whatsapp", label: "WhatsApp recebido", icon: MessageSquare },
  { value: "instagram", label: "DM Instagram", icon: Instagram },
  { value: "facebook", label: "DM Facebook", icon: Facebook },
  { value: "tiktok", label: "DM TikTok", icon: Music2 },
];

const EVENTS_BY_SOURCE: Record<TriggerSource, { value: TriggerEvent; label: string }[]> = {
  email: [
    { value: "opened", label: "Abriu o e-mail" },
    { value: "clicked", label: "Clicou no link" },
    { value: "replied", label: "Respondeu" },
  ],
  whatsapp: [{ value: "message_received", label: "Recebeu mensagem" }],
  instagram: [{ value: "message_received", label: "Recebeu mensagem" }],
  facebook: [{ value: "message_received", label: "Recebeu mensagem" }],
  tiktok: [{ value: "message_received", label: "Recebeu mensagem" }],
};

const ACTIONS: { value: ActionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "whatsapp", label: "Enviar WhatsApp", icon: MessageSquare },
  { value: "sms", label: "Enviar SMS", icon: Smartphone },
  { value: "email", label: "Enviar e-mail", icon: Mail },
];

const DIAS = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Na fila",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
};

const emptyDraft = (): Partial<TriggerAutomation> => ({
  nome: "",
  ativo: false,
  prioridade: 100,
  trigger_source: "email",
  trigger_event: "clicked",
  trigger_config: { provider: "evolution", team_member_ids: [], keywords: [] },
  action_type: "whatsapp",
  action_config: { mensagem: "", link_url: "", assunto: "", team_member_id: null },
  horario_inicio: 9,
  horario_fim: 18,
  dias_semana: [1, 2, 3, 4, 5],
  delay_minutos: 0,
  cooldown_horas: 24,
  dedupe_window_minutes: 1440,
  max_por_dia: 200,
});

function useTeamMembersWithInstances() {
  return useQuery({
    queryKey: ["team_members", "instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, nome_completo, role, evolution_instance_name, evolution_phone, whatsapp_number")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function TriggerAutomations() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<TriggerAutomation>>(emptyDraft());
  const [testDestino, setTestDestino] = useState("");
  const { data: members } = useTeamMembersWithInstances();

  const { data: automations, isLoading } = useQuery({
    queryKey: ["trigger_automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trigger_automations")
        .select("*")
        .order("prioridade")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TriggerAutomation[];
    },
  });

  const { data: queue } = useQuery({
    queryKey: ["trigger_automation_queue", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trigger_automation_queue")
        .select("*, trigger_automations(nome)")
        .in("status", ["pending", "sending"])
        .order("prioridade")
        .order("scheduled_at")
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: history } = useQuery({
    queryKey: ["trigger_automation_queue", "history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trigger_automation_queue")
        .select("*, trigger_automations(nome)")
        .in("status", ["sent", "failed", "skipped"])
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<TriggerAutomation>) => {
      const row = {
        nome: payload.nome,
        descricao: payload.descricao ?? null,
        ativo: payload.ativo ?? false,
        prioridade: payload.prioridade ?? 100,
        trigger_source: payload.trigger_source,
        trigger_event: payload.trigger_event,
        trigger_config: payload.trigger_config ?? {},
        action_type: payload.action_type,
        action_config: payload.action_config ?? {},
        instance_name: payload.instance_name ?? null,
        horario_inicio: payload.horario_inicio ?? 9,
        horario_fim: payload.horario_fim ?? 18,
        dias_semana: payload.dias_semana ?? [1, 2, 3, 4, 5],
        delay_minutos: payload.delay_minutos ?? 0,
        cooldown_horas: payload.cooldown_horas ?? 24,
        dedupe_window_minutes: payload.dedupe_window_minutes ?? 1440,
        max_por_dia: payload.max_por_dia ?? 200,
      };
      if (payload.id) {
        const { error } = await supabase.from("trigger_automations").update(row as never).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trigger_automations").insert(row as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Automação salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["trigger_automations"] });
    },
    onError: (e: Error) => toast.error(`Falha ao salvar: ${e.message}`),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("trigger_automations").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trigger_automations"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trigger_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Automação removida");
      qc.invalidateQueries({ queryKey: ["trigger_automations"] });
    },
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("smart-ops-trigger-automations", {
        body: { mode: "cycle" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: { sent?: number; failed?: number }) => {
      toast.success(`Ciclo executado — ${data?.sent ?? 0} enviados, ${data?.failed ?? 0} falhas`);
      qc.invalidateQueries({ queryKey: ["trigger_automation_queue"] });
    },
    onError: (e: Error) => toast.error(`Falha no ciclo: ${e.message}`),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!draft.id) throw new Error("Salve a automação antes de testar");
      const { data, error } = await supabase.functions.invoke("smart-ops-trigger-automations", {
        body: { mode: "test", automation_id: draft.id, destino: testDestino },
      });
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok === false) throw new Error(String((data as { error?: string })?.error));
      return data;
    },
    onSuccess: () => toast.success("Teste enviado"),
    onError: (e: Error) => toast.error(`Teste falhou: ${e.message}`),
  });

  const cancelQueued = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trigger_automation_queue")
        .update({ status: "skipped", error_message: "cancelado manualmente" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trigger_automation_queue"] }),
  });

  const cfg = (draft.trigger_config ?? {}) as Record<string, any>;
  const act = (draft.action_config ?? {}) as Record<string, any>;
  const setCfg = (patch: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, trigger_config: { ...(d.trigger_config ?? {}), ...patch } }));
  const setAct = (patch: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, action_config: { ...(d.action_config ?? {}), ...patch } }));

  const instances = useMemo(
    () => (members ?? []).filter((m) => m.evolution_instance_name),
    [members],
  );

  const openEditor = (a?: TriggerAutomation) => {
    setDraft(a ? { ...a } : emptyDraft());
    setTestDestino("");
    setOpen(true);
  };

  const smsLength = String(act.mensagem ?? "").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Automações por Gatilho</CardTitle>
            <p className="text-xs text-muted-foreground">
              Origem (e-mail, DM, WhatsApp) → ação (SMS, e-mail, WhatsApp) com fila e ID único anti-duplicidade
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
            {runNow.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            Rodar agora
          </Button>
          <Button size="sm" onClick={() => openEditor()}>
            <Plus className="w-4 h-4 mr-1" /> Nova automação
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista">Automações</TabsTrigger>
            <TabsTrigger value="fila">Fila {queue?.length ? `(${queue.length})` : ""}</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* ───── Lista ───── */}
          <TabsContent value="lista" className="space-y-3 pt-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
              </div>
            )}
            {!isLoading && !automations?.length && (
              <p className="text-sm text-muted-foreground">
                Nenhuma automação por gatilho criada ainda.
              </p>
            )}
            {(automations ?? []).map((a) => {
              const Src = SOURCES.find((s) => s.value === a.trigger_source)?.icon ?? Mail;
              const Act = ACTIONS.find((s) => s.value === a.action_type)?.icon ?? MessageSquare;
              return (
                <div key={a.id} className="flex items-start justify-between gap-4 border rounded-lg p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{a.nome}</span>
                      <Badge variant="outline" className="gap-1">
                        <Src className="w-3 h-3" />
                        {SOURCES.find((s) => s.value === a.trigger_source)?.label}
                        {" · "}
                        {EVENTS_BY_SOURCE[a.trigger_source]?.find((e) => e.value === a.trigger_event)?.label}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Act className="w-3 h-3" />
                        {ACTIONS.find((s) => s.value === a.action_type)?.label}
                      </Badge>
                      <Badge variant="outline">Prioridade {a.prioridade}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.horario_inicio}h–{a.horario_fim}h ·{" "}
                      {a.dias_semana.map((d) => DIAS.find((x) => x.v === d)?.l).join(", ")} · atraso{" "}
                      {a.delay_minutos} min · máx {a.max_por_dia}/dia
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Anti-duplicidade: {a.dedupe_window_minutes} min ·
                      cooldown por lead {a.cooldown_horas} h
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={a.ativo} onCheckedChange={(v) => toggle.mutate({ id: a.id, ativo: v })} />
                    <Button variant="ghost" size="icon" onClick={() => openEditor(a)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* ───── Fila ───── */}
          <TabsContent value="fila" className="pt-4 space-y-2">
            {!queue?.length && <p className="text-sm text-muted-foreground">Fila vazia.</p>}
            {(queue ?? []).map((q: any) => (
              <div key={q.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium">{q.trigger_automations?.nome ?? "—"}</span>
                    <Badge variant="outline">{q.channel}</Badge>
                    <Badge variant="secondary">{STATUS_LABEL[q.status] ?? q.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      previsto {new Date(q.scheduled_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {q.destino} — {String(q.rendered_message ?? "").slice(0, 140)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => cancelQueued.mutate(q.id)}>
                  Cancelar
                </Button>
              </div>
            ))}
          </TabsContent>

          {/* ───── Histórico ───── */}
          <TabsContent value="historico" className="pt-4 space-y-2">
            {!history?.length && <p className="text-sm text-muted-foreground">Sem envios registrados.</p>}
            {(history ?? []).map((q: any) => (
              <div key={q.id} className="border rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{q.trigger_automations?.nome ?? "—"}</span>
                  <Badge variant="outline">{q.channel}</Badge>
                  <Badge variant={q.status === "sent" ? "secondary" : "destructive"}>
                    {STATUS_LABEL[q.status] ?? q.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(q.sent_at ?? q.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {q.destino} — {String(q.rendered_message ?? "").slice(0, 200)}
                </p>
                {q.error_message && <p className="text-xs text-destructive mt-1">{q.error_message}</p>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* ───── Editor ───── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar automação" : "Nova automação por gatilho"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={draft.nome ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                  placeholder="Ex: Clicou no e-mail → WhatsApp do vendedor"
                />
              </div>
              <div>
                <Label>Prioridade (menor = antes)</Label>
                <Input
                  type="number"
                  value={draft.prioridade ?? 100}
                  onChange={(e) => setDraft((d) => ({ ...d, prioridade: Number(e.target.value) }))}
                />
              </div>
            </div>

            {/* Origem */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium">1. Origem do gatilho</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={draft.trigger_source}
                    onValueChange={(v: TriggerSource) =>
                      setDraft((d) => ({
                        ...d,
                        trigger_source: v,
                        trigger_event: EVENTS_BY_SOURCE[v][0].value,
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Evento</Label>
                  <Select
                    value={draft.trigger_event}
                    onValueChange={(v: TriggerEvent) => setDraft((d) => ({ ...d, trigger_event: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(EVENTS_BY_SOURCE[draft.trigger_source as TriggerSource] ?? []).map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {draft.trigger_source === "whatsapp" && (
                <>
                  <div>
                    <Label>Onde a mensagem chega</Label>
                    <Select
                      value={String(cfg.provider ?? "evolution")}
                      onValueChange={(v) => setCfg({ provider: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="evolution">Instâncias próprias (Evolution)</SelectItem>
                        <SelectItem value="zernio">Zernio (WhatsApp)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {String(cfg.provider ?? "evolution") === "evolution" && (
                    <div>
                      <Label>Números do time monitorados</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded-md p-2 mt-1">
                        {instances.map((m) => {
                          const selected = (cfg.team_member_ids ?? []) as string[];
                          return (
                            <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selected.includes(m.id)}
                                onChange={() =>
                                  setCfg({
                                    team_member_ids: selected.includes(m.id)
                                      ? selected.filter((x) => x !== m.id)
                                      : [...selected, m.id],
                                  })
                                }
                              />
                              <span className="truncate">
                                {m.nome_completo}
                                <span className="text-muted-foreground">
                                  {" "}— {m.evolution_phone ?? m.whatsapp_number ?? m.evolution_instance_name}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                        {!instances.length && (
                          <p className="text-xs text-muted-foreground">Nenhuma instância configurada.</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sem seleção, monitora todas as instâncias.
                      </p>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>Palavras-chave na mensagem (opcional, separadas por vírgula)</Label>
                <Input
                  value={((cfg.keywords ?? []) as string[]).join(", ")}
                  onChange={(e) =>
                    setCfg({
                      keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                    })
                  }
                  placeholder="preço, orçamento, resina"
                />
              </div>
            </div>

            {/* Ação */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium">2. O que fazer</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Ação</Label>
                  <Select
                    value={draft.action_type}
                    onValueChange={(v: ActionType) => setDraft((d) => ({ ...d, action_type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {draft.action_type === "whatsapp" && (
                  <div>
                    <Label>Instância que envia</Label>
                    <Select
                      value={String(act.team_member_id ?? "")}
                      onValueChange={(v) => {
                        const m = instances.find((x) => x.id === v);
                        setAct({ team_member_id: v });
                        setDraft((d) => ({ ...d, instance_name: m?.evolution_instance_name ?? null }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar instância…" /></SelectTrigger>
                      <SelectContent>
                        {instances.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome_completo} — {m.evolution_instance_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {draft.action_type === "email" && (
                <div>
                  <Label>Assunto</Label>
                  <Input
                    value={String(act.assunto ?? "")}
                    onChange={(e) => setAct({ assunto: e.target.value })}
                    placeholder="Assunto do e-mail"
                  />
                </div>
              )}

              <div>
                <Label>
                  {draft.action_type === "sms"
                    ? "Mensagem do SMS (link encurtado automático)"
                    : draft.action_type === "email"
                      ? "Conteúdo do e-mail (HTML permitido)"
                      : "Mensagem do WhatsApp"}
                </Label>
                <Textarea
                  rows={draft.action_type === "email" ? 8 : 5}
                  value={String(act.mensagem ?? "")}
                  onChange={(e) => setAct({ mensagem: e.target.value })}
                  placeholder={
                    draft.action_type === "sms"
                      ? "Oi {{primeiro_nome}}, veja: {{link}}"
                      : "Oi {{primeiro_nome}}, tudo bem? {{link}}"
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis: <code>{"{{primeiro_nome}}"}</code> <code>{"{{nome}}"}</code>{" "}
                  <code>{"{{link}}"}</code> <code>{"{{telefone}}"}</code> <code>{"{{email}}"}</code>
                  {draft.action_type === "sms" && (
                    <span className={smsLength > 160 ? " text-destructive" : ""}>
                      {" "}· {smsLength}/160 caracteres
                    </span>
                  )}
                </p>
              </div>

              <div>
                <Label>Link de destino (será encurtado por lead)</Label>
                <Input
                  value={String(act.link_url ?? "")}
                  onChange={(e) => setAct({ link_url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </div>

            {/* Horários / prioridade / dedupe */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium">3. Horários, prioridade e anti-duplicidade</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Hora início</Label>
                  <Input
                    type="number" min={0} max={23}
                    value={draft.horario_inicio ?? 9}
                    onChange={(e) => setDraft((d) => ({ ...d, horario_inicio: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Hora fim</Label>
                  <Input
                    type="number" min={0} max={23}
                    value={draft.horario_fim ?? 18}
                    onChange={(e) => setDraft((d) => ({ ...d, horario_fim: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Atraso (min)</Label>
                  <Input
                    type="number" min={0}
                    value={draft.delay_minutos ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, delay_minutos: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Máx/dia</Label>
                  <Input
                    type="number" min={1}
                    value={draft.max_por_dia ?? 200}
                    onChange={(e) => setDraft((d) => ({ ...d, max_por_dia: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <Label>Dias da semana</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DIAS.map((d) => {
                    const sel = (draft.dias_semana ?? []).includes(d.v);
                    return (
                      <Button
                        key={d.v}
                        type="button"
                        size="sm"
                        variant={sel ? "default" : "outline"}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            dias_semana: sel
                              ? (prev.dias_semana ?? []).filter((x) => x !== d.v)
                              : [...(prev.dias_semana ?? []), d.v].sort(),
                          }))
                        }
                      >
                        {d.l}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Janela anti-duplicidade (min)</Label>
                  <Input
                    type="number" min={1}
                    value={draft.dedupe_window_minutes ?? 1440}
                    onChange={(e) => setDraft((d) => ({ ...d, dedupe_window_minutes: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Cooldown por lead (horas)</Label>
                  <Input
                    type="number" min={0}
                    value={draft.cooldown_horas ?? 24}
                    onChange={(e) => setDraft((d) => ({ ...d, cooldown_horas: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Cada envio recebe um ID único (canal + destino + mensagem). O mesmo ID não entra na fila duas
                vezes dentro da janela — mesma proteção usada nos grupos de WhatsApp e nos fluxos de Instagram.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={draft.ativo ?? false}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, ativo: v }))}
              />
              <span className="text-sm">Automação ativa</span>
            </div>

            {draft.id && (
              <div className="border rounded-lg p-3 space-y-2">
                <Label>Testar envio</Label>
                <div className="flex gap-2">
                  <Input
                    value={testDestino}
                    onChange={(e) => setTestDestino(e.target.value)}
                    placeholder={draft.action_type === "email" ? "email@dominio.com" : "5516999999999"}
                  />
                  <Button
                    variant="outline"
                    onClick={() => sendTest.mutate()}
                    disabled={!testDestino || sendTest.isPending}
                  >
                    {sendTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate(draft)} disabled={!draft.nome || save.isPending}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
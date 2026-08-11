import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  Pencil,
  MessageSquareDot,
  FileText,
  MessageSquare,
  Clock,
  Send,
  Loader2,
} from "lucide-react";
import { HighlightVariables, MessageVariableBar } from "@/components/smartops/MessageVariableBar";

interface LiaAutomation {
  id: string;
  slug: string;
  nome: string;
  subtitulo: string | null;
  icone: string;
  cor: string;
  trigger_event: string | null;
  trigger_tags: string[];
  canal: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  mensagem_horario_comercial: string | null;
  mensagem_fora_horario: string | null;
  evolution_instance_name: string | null;
  ativo: boolean;
  metrics?: { enviadasHoje: number; enviadasTotal: number; cliques: number; taxa: number };
}

interface WaInstance {
  id: string;
  nome_completo: string | null;
  evolution_instance_name: string;
  evolution_phone: string | null;
  evolution_status: string | null;
}

interface SellerNumber {
  id: string;
  nome_completo: string | null;
  role: string | null;
  phone: string | null;
  wa_welcome_link_enabled: boolean;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "message-square-dot": MessageSquareDot,
  "file-text": FileText,
  "message-square": MessageSquare,
};

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  green: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", ring: "ring-purple-200" },
};

export function SmartOpsLiaAutomations() {
  const [items, setItems] = useState<LiaAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LiaAutomation | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [sellers, setSellers] = useState<SellerNumber[]>([]);
  const [togglingSeller, setTogglingSeller] = useState<string | null>(null);

  const newDraft = (): LiaAutomation => ({
    id: "",
    slug: "",
    nome: "",
    subtitulo: "",
    icone: "message-square",
    cor: "blue",
    trigger_event: null,
    trigger_tags: [],
    canal: "whatsapp",
    horario_inicio: "08:00",
    horario_fim: "18:00",
    mensagem_horario_comercial: "",
    mensagem_fora_horario: "",
    evolution_instance_name: null,
    ativo: false,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("automacoes-lia", { method: "GET" });
    if (error) {
      toast.error("Erro ao carregar automações LIA");
    } else {
      // O "Briefing ao Vendedor" é configurado no card dedicado
      // (seller_briefing_config) — a linha legada em lia_automations não
      // controla nada e aparecia duplicada na UI.
      setItems(
        (data?.automations ?? []).filter(
          (a: LiaAutomation) => a.slug !== "briefing_vendedor",
        ),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id, nome_completo, role, evolution_instance_name, evolution_phone, evolution_status")
        .eq("ativo", true)
        .not("evolution_instance_name", "is", null)
        .order("nome_completo");
      setInstances((data ?? []) as WaInstance[]);
    })();
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id, nome_completo, role, whatsapp_number, notification_phone, wa_welcome_link_enabled")
        .eq("ativo", true)
        .order("nome_completo");
      setSellers(
        ((data ?? []) as any[])
          .map((m) => ({
            id: m.id as string,
            nome_completo: m.nome_completo as string | null,
            role: m.role as string | null,
            phone: (m.notification_phone || m.whatsapp_number || null) as string | null,
            wa_welcome_link_enabled: m.wa_welcome_link_enabled !== false,
          }))
          .filter((m) => !!m.phone),
      );
    })();
  }, []);

  const toggleSellerNumber = async (s: SellerNumber, enabled: boolean) => {
    setTogglingSeller(s.id);
    setSellers((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, wa_welcome_link_enabled: enabled } : x)),
    );
    const { error } = await supabase
      .from("team_members")
      .update({ wa_welcome_link_enabled: enabled } as never)
      .eq("id", s.id);
    setTogglingSeller(null);
    if (error) {
      toast.error("Falha ao atualizar o número do vendedor");
      setSellers((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, wa_welcome_link_enabled: !enabled } : x)),
      );
    } else {
      toast.success(
        `${s.nome_completo ?? "Vendedor"} ${enabled ? "liberado" : "bloqueado"} nas boas-vindas`,
      );
    }
  };

  const toggleActive = async (a: LiaAutomation, ativo: boolean) => {
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, ativo } : x)));
    const { error } = await supabase.functions.invoke("automacoes-lia", {
      method: "PUT",
      body: { id: a.id, ativo },
    });
    if (error) {
      toast.error("Falha ao atualizar status");
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, ativo: !ativo } : x)));
    } else {
      toast.success(`Automação ${ativo ? "ativada" : "desativada"}`);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.id) {
      if (!editing.nome.trim()) {
        toast.error("Informe o nome da automação");
        return;
      }
      setSavingId("new");
      const { error } = await supabase.functions.invoke("automacoes-lia", {
        method: "POST",
        body: {
          nome: editing.nome,
          subtitulo: editing.subtitulo,
          canal: editing.canal,
          trigger_tags: editing.trigger_tags,
          horario_inicio: editing.horario_inicio,
          horario_fim: editing.horario_fim,
          evolution_instance_name: editing.evolution_instance_name,
          mensagem_horario_comercial: editing.mensagem_horario_comercial,
          mensagem_fora_horario: editing.mensagem_fora_horario,
        },
      });
      setSavingId(null);
      if (error) {
        toast.error("Falha ao criar automação");
      } else {
        toast.success("Automação criada");
        setEditing(null);
        setCreating(false);
        load();
      }
      return;
    }
    setSavingId(editing.id);
    const { error } = await supabase.functions.invoke("automacoes-lia", {
      method: "PATCH",
      body: {
        id: editing.id,
        mensagem_horario_comercial: editing.mensagem_horario_comercial,
        mensagem_fora_horario: editing.mensagem_fora_horario,
        horario_inicio: editing.horario_inicio,
        horario_fim: editing.horario_fim,
        evolution_instance_name: editing.evolution_instance_name,
      },
    });
    setSavingId(null);
    if (error) {
      toast.error("Falha ao salvar");
    } else {
      toast.success("Automação atualizada");
      setEditing(null);
      load();
    }
  };

  const ativasCount = items.filter((i) => i.ativo).length;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Automações LIA</h3>
            <p className="text-xs text-muted-foreground">Disparos automáticos da assistente LIA</p>
          </div>
          <Badge variant="secondary" className="ml-2">
            {ativasCount} {ativasCount === 1 ? "ativa" : "ativas"}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setCreating(true);
            setEditing(newDraft());
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Nova automação
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando automações...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nenhuma automação LIA configurada
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((a) => {
              const Icon = ICONS[a.icone] ?? MessageSquare;
              const color = COLOR_MAP[a.cor] ?? COLOR_MAP.blue;
              return (
                <div key={a.id} className="rounded-lg border bg-card p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${color.bg} ring-1 ${color.ring}`}>
                        <Icon className={`w-5 h-5 ${color.text}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{a.nome}</div>
                        <div className="text-xs text-muted-foreground">{a.subtitulo}</div>
                      </div>
                    </div>
                    <Switch checked={a.ativo} onCheckedChange={(v) => toggleActive(a, v)} />
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded bg-muted/50">
                      <div className="text-base font-bold">{a.metrics?.enviadasHoje ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">Hoje</div>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <div className="text-base font-bold">{a.metrics?.enviadasTotal ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">Total</div>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <div className="text-base font-bold">{a.metrics?.cliques ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">Cliques</div>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <div className="text-base font-bold">{(a.metrics?.taxa ?? 0).toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground">Taxa</div>
                    </div>
                  </div>

                  {/* Trigger tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Gatilho:
                    </span>
                    {a.trigger_tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>

                  {/* Message variants */}
                  <Tabs defaultValue="comercial">
                    <TabsList className="h-8">
                      <TabsTrigger value="comercial" className="text-xs">
                        Horário comercial
                      </TabsTrigger>
                      <TabsTrigger value="fora" className="text-xs">
                        Fora do horário
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="comercial">
                      <div className="rounded border bg-muted/30 p-3 min-h-[60px]">
                        <HighlightVariables text={a.mensagem_horario_comercial ?? ""} />
                      </div>
                    </TabsContent>
                    <TabsContent value="fora">
                      <div className="rounded border bg-muted/30 p-3 min-h-[60px]">
                        <HighlightVariables text={a.mensagem_fora_horario ?? ""} />
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(a.horario_inicio ?? "08:00").slice(0, 5)}–
                        {(a.horario_fim ?? "18:00").slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        {a.canal}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        {a.evolution_instance_name ? (
                          <>
                            {a.evolution_instance_name}
                            {(() => {
                              const inst = instances.find(
                                (i) => i.evolution_instance_name === a.evolution_instance_name,
                              );
                              return inst?.evolution_phone ? ` · ${inst.evolution_phone}` : "";
                            })()}
                          </>
                        ) : (
                          <span className="text-amber-600">instância não definida</span>
                        )}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {creating ? "Nova automação LIA" : `Editar — ${editing?.nome}`}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {creating && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={editing.nome}
                      placeholder="Ex.: Follow-up de proposta"
                      onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Subtítulo</Label>
                    <Input
                      value={editing.subtitulo ?? ""}
                      placeholder="Descrição curta"
                      onChange={(e) => setEditing({ ...editing, subtitulo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Canal</Label>
                    <Input
                      value={editing.canal}
                      placeholder="whatsapp"
                      onChange={(e) => setEditing({ ...editing, canal: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Gatilhos (separados por vírgula)</Label>
                    <Input
                      value={editing.trigger_tags.join(", ")}
                      placeholder="proposta_enviada, sem_resposta"
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          trigger_tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Início horário comercial</Label>
                  <Input
                    type="time"
                    value={(editing.horario_inicio ?? "08:00").slice(0, 5)}
                    onChange={(e) =>
                      setEditing({ ...editing, horario_inicio: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Fim horário comercial</Label>
                  <Input
                    type="time"
                    value={(editing.horario_fim ?? "18:00").slice(0, 5)}
                    onChange={(e) => setEditing({ ...editing, horario_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Número liberado para esta mensagem</Label>
                  {editing.evolution_instance_name && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setEditing({ ...editing, evolution_instance_name: null })}
                    >
                      Limpar seleção
                    </Button>
                  )}
                </div>
                {instances.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded border p-3">
                    Nenhum membro da equipe com instância WhatsApp configurada.
                  </p>
                ) : (
                  <ScrollArea className="h-56 rounded border">
                    <div className="divide-y">
                      {instances.map((i) => {
                        const checked = editing.evolution_instance_name === i.evolution_instance_name;
                        const connected = i.evolution_status === "connected";
                        return (
                          <label
                            key={i.id}
                            className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                setEditing({
                                  ...editing,
                                  evolution_instance_name: v ? i.evolution_instance_name : null,
                                })
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {i.nome_completo || i.evolution_instance_name}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {i.evolution_phone || "sem número"} · {i.evolution_instance_name}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                connected
                                  ? "text-[10px] bg-green-50 text-green-700 border-green-200"
                                  : "text-[10px] bg-muted text-muted-foreground"
                              }
                            >
                              {connected ? "conectada" : i.evolution_status ?? "sem status"}
                            </Badge>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Marque o membro cujo número vai disparar esta mensagem (apenas um). Sem seleção, o
                  envio usa o membro com papel <code>lia_comms</code>.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  Números de vendedores liberados no link da mensagem
                </Label>
                {sellers.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded border p-3">
                    Nenhum membro da equipe com número cadastrado.
                  </p>
                ) : (
                  <ScrollArea className="h-56 rounded border">
                    <div className="divide-y">
                      {sellers.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={s.wa_welcome_link_enabled}
                            disabled={togglingSeller === s.id}
                            onCheckedChange={(v) => toggleSellerNumber(s, v === true)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {s.nome_completo ?? "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {s.phone}
                              {s.role ? ` · ${s.role}` : ""}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              s.wa_welcome_link_enabled
                                ? "text-[10px] bg-green-50 text-green-700 border-green-200"
                                : "text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                            }
                          >
                            {s.wa_welcome_link_enabled ? "liberado" : "bloqueado"}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Desmarque o vendedor cujo WhatsApp está quebrado/inexistente: o lead dele não recebe
                  boas-vindas até o número ser corrigido — assim nenhum link quebrado é enviado.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Mensagem horário comercial</Label>
                <MessageVariableBar
                  onInsert={(k) =>
                    setEditing({
                      ...editing,
                      mensagem_horario_comercial:
                        (editing.mensagem_horario_comercial ?? "") + `{${k}}`,
                    })
                  }
                />
                <Textarea
                  rows={4}
                  value={editing.mensagem_horario_comercial ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, mensagem_horario_comercial: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Mensagem fora do horário</Label>
                <MessageVariableBar
                  onInsert={(k) =>
                    setEditing({
                      ...editing,
                      mensagem_fora_horario: (editing.mensagem_fora_horario ?? "") + `{${k}}`,
                    })
                  }
                />
                <Textarea
                  rows={4}
                  value={editing.mensagem_fora_horario ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, mensagem_fora_horario: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={!!savingId}>
              {savingId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : creating ? (
                "Criar automação"
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
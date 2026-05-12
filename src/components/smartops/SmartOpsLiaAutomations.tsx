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
import { HighlightVariables, WaLeadsVariableBar } from "@/components/smartops/WaLeadsVariableBar";

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
  ativo: boolean;
  metrics?: { enviadasHoje: number; enviadasTotal: number; cliques: number; taxa: number };
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("automacoes-lia", { method: "GET" });
    if (error) {
      toast.error("Erro ao carregar automações LIA");
    } else {
      setItems(data?.automations ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
    setSavingId(editing.id);
    const { error } = await supabase.functions.invoke("automacoes-lia", {
      method: "PATCH",
      body: {
        id: editing.id,
        mensagem_horario_comercial: editing.mensagem_horario_comercial,
        mensagem_fora_horario: editing.mensagem_fora_horario,
        horario_inicio: editing.horario_inicio,
        horario_fim: editing.horario_fim,
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
        <Button size="sm" variant="outline" disabled title="Em breve">
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar — {editing?.nome}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
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
                <Label className="text-xs">Mensagem horário comercial</Label>
                <WaLeadsVariableBar
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
                <WaLeadsVariableBar
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
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={!!savingId}>
              {savingId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
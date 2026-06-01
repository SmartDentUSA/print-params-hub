import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare, Clock, Sparkles, Image as ImageIcon, Video, Link2,
  Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, FileText, Eye, Mic, Paperclip, CalendarIcon,
} from "lucide-react";
import type { FlowNode, FlowNodeType, MsgNode, WaitNode, AiNode, MediaNode, LinkNode } from "./types";
import { WaContentNodeSelector } from "./WaContentNodeSelector";
import { WaMediaUploader } from "./WaMediaUploader";

interface Props {
  open: boolean;
  groupId?: string;
  groupIds?: string[];
  campaignId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const nodeMeta: Record<FlowNodeType, { label: string; icon: any; color: string }> = {
  msg:   { label: "Mensagem",     icon: MessageSquare, color: "text-blue-600" },
  wait:  { label: "Aguardar",     icon: Clock,         color: "text-amber-600" },
  ai:    { label: "IA + Conteúdo", icon: Sparkles,     color: "text-purple-600" },
  image: { label: "Imagem",       icon: ImageIcon,     color: "text-emerald-600" },
  video: { label: "Vídeo",        icon: Video,         color: "text-red-600" },
  audio: { label: "Áudio",        icon: Mic,           color: "text-pink-600" },
  document: { label: "Documento", icon: Paperclip,     color: "text-slate-600" },
  link:  { label: "Link",         icon: Link2,         color: "text-cyan-600" },
};

function newNode(type: FlowNodeType): FlowNode {
  const id = crypto.randomUUID();
  switch (type) {
    case "msg":   return { id, type, text: "", mention_all: false };
    case "wait":  return { id, type, days: 1, hours: 0, minutes: 0, time: "09:00", weekdays_only: false };
    case "ai":    return { id, type, ai_source_type: "article", ai_source_id: "", ai_source_title: "", ai_prompt_override: "" };
    case "image":
    case "video":
    case "audio":
    case "document": return { id, type, media_url: "", caption: "" };
    case "link":  return { id, type, title: "", description: "", url: "" };
  }
}

export function WaGroupFlowBuilder({ open, groupId, groupIds, campaignId, onClose, onSaved }: Props) {
  const isMulti = !groupId && Array.isArray(groupIds) && groupIds.length > 0;
  const targetIds: string[] = isMulti ? (groupIds as string[]) : (groupId ? [groupId] : []);
  const [name, setName] = useState("");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [delaySeconds, setDelaySeconds] = useState(30);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectorOpenFor, setSelectorOpenFor] = useState<string | null>(null);
  const [previewByNode, setPreviewByNode] = useState<Record<string, { loading: boolean; text?: string; provider?: string; error?: string }>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      if (campaignId) {
        const { data, error } = await (supabase as any)
          .from("wa_campaigns")
          .select("name, flow_json, daily_limit, delay_seconds, started_at, status")
          .eq("id", campaignId)
          .single();
        if (error) { toast.error(error.message); setLoading(false); return; }
        setName(data.name ?? "");
        setNodes(Array.isArray(data.flow_json) ? data.flow_json : []);
        setDailyLimit(data.daily_limit ?? 50);
        setDelaySeconds(data.delay_seconds ?? 30);
        // Pré-carrega agendamento: só faz sentido enquanto for futuro e ainda não rodou.
        if (data.started_at && new Date(data.started_at).getTime() > Date.now()) {
          const d = new Date(data.started_at);
          setScheduleEnabled(true);
          setScheduleDate(d);
          setScheduleTime(
            `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
          );
        } else {
          setScheduleEnabled(false);
          setScheduleDate(undefined);
          setScheduleTime("09:00");
        }
      } else {
        setName(isMulti ? `Régua única (${targetIds.length} grupos)` : "Nova campanha");
        setNodes([]);
        setDailyLimit(50);
        setDelaySeconds(30);
        setScheduleEnabled(false);
        setScheduleDate(undefined);
        setScheduleTime("09:00");
      }
      setLoading(false);
    })();
  }, [open, campaignId]);

  const addNode = (type: FlowNodeType) => setNodes(n => [...n, newNode(type)]);
  const removeNode = (id: string) => setNodes(n => n.filter(x => x.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    setNodes(n => {
      const i = n.findIndex(x => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= n.length) return n;
      const copy = [...n];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };
  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    setNodes(n => n.map(x => x.id === id ? ({ ...x, ...patch } as FlowNode) : x));
  };

  const previewAi = async (n: AiNode) => {
    if (!n.ai_source_id) { toast.error("Selecione um conteúdo antes."); return; }
    setPreviewByNode(p => ({ ...p, [n.id]: { loading: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("wa-ai-preview", {
        body: {
          ai_source_type: n.ai_source_type,
          ai_source_id: n.ai_source_id,
          ai_source_title: n.ai_source_title,
          ai_prompt_override: n.ai_prompt_override,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha ao gerar preview");
      setPreviewByNode(p => ({ ...p, [n.id]: { loading: false, text: data.preview, provider: data.provider } }));
    } catch (err: any) {
      setPreviewByNode(p => ({ ...p, [n.id]: { loading: false, error: err?.message ?? String(err) } }));
      toast.error("Falha no preview: " + (err?.message ?? String(err)));
    }
  };

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!name.trim()) errors.push("Nome da campanha é obrigatório.");
    if (nodes.length === 0) errors.push("Adicione pelo menos um nó.");
    nodes.forEach((n, idx) => {
      const tag = `Nó #${idx + 1} (${nodeMeta[n.type].label})`;
      if (n.type === "msg" && !n.text.trim()) errors.push(`${tag}: texto vazio.`);
      if (n.type === "ai" && !n.ai_source_id) errors.push(`${tag}: selecione um conteúdo.`);
      if ((n.type === "image" || n.type === "video" || n.type === "audio" || n.type === "document") && !n.media_url.trim()) errors.push(`${tag}: arquivo não enviado.`);
      if (n.type === "link" && (!n.url.trim() || !n.title.trim())) errors.push(`${tag}: título e URL obrigatórios.`);
      if (n.type === "wait") {
        const d = (n as WaitNode).days ?? 0;
        const h = (n as WaitNode).hours ?? 0;
        const m = (n as WaitNode).minutes ?? 0;
        if (d < 0 || h < 0 || m < 0) errors.push(`${tag}: tempo inválido.`);
        if (d === 0 && h === 0 && m === 0) errors.push(`${tag}: defina dias, horas ou minutos (>0).`);
      }
    });
    return errors;
  }, [name, nodes]);

  const computeStartedAt = (): { iso: string | null; error?: string } => {
    if (!scheduleEnabled) return { iso: null };
    if (!scheduleDate) return { iso: null, error: "Selecione a data de início." };
    const [hh, mm] = (scheduleTime || "09:00").split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return { iso: null, error: "Hora inválida." };
    const d = new Date(scheduleDate);
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= Date.now()) return { iso: null, error: "A data/hora de início deve ser futura." };
    return { iso: d.toISOString() };
  };

  const handleSave = async (activate: boolean) => {
    if (activate && validation.length > 0) {
      toast.error(validation[0]);
      return;
    }
    const sched = computeStartedAt();
    if (sched.error) { toast.error(sched.error); return; }
    setSaving(true);
    try {
      let cid = campaignId;
      const payload: any = {
        group_id: isMulti ? null : groupId,
        name: name.trim(),
        flow_json: nodes,
        daily_limit: dailyLimit,
        delay_seconds: delaySeconds,
        started_at: sched.iso,
      };
      if (cid) {
        const { error } = await (supabase as any).from("wa_campaigns").update(payload).eq("id", cid);
        if (error) throw error;
      } else {
        payload.status = "draft";
        const { data, error } = await (supabase as any)
          .from("wa_campaigns")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        cid = data.id;
        if (isMulti) {
          // Vincula a campanha aos N grupos via junction table
          const rows = targetIds.map(gid => ({ campaign_id: cid, group_id: gid }));
          const { error: linkErr } = await (supabase as any)
            .from("wa_campaign_groups")
            .insert(rows);
          if (linkErr) throw linkErr;
        } else if (groupId) {
          // Single-group: vincula via active_campaign_id se grupo estiver livre
          const { data: g } = await (supabase as any)
            .from("wa_groups")
            .select("active_campaign_id")
            .eq("id", groupId)
            .single();
          if (!g?.active_campaign_id) {
            await (supabase as any)
              .from("wa_groups")
              .update({ active_campaign_id: cid })
              .eq("id", groupId);
          }
        }
      }

      if (activate) {
        const { data, error } = await supabase.functions.invoke("wa-campaign-builder", { body: { campaign_id: cid } });
        if (error) {
          let detail = (data as any)?.error || (error as any)?.message || String(error);
          try {
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) detail = body.error;
            } else if (ctx && typeof ctx.text === "function") {
              const txt = await ctx.text();
              if (txt) { try { const j = JSON.parse(txt); detail = j.error ?? txt; } catch { detail = txt; } }
            }
          } catch { /* ignore */ }
          throw new Error(detail);
        }
        if (data && (data as any).ok === false) {
          throw new Error((data as any).error ?? "Falha ao ativar campanha");
        }
        toast.success(`Campanha ativada — primeira mensagem em ${new Date((data as any)?.first_send).toLocaleString("pt-BR")}`);
      } else {
        toast.success("Rascunho salvo");
      }
      onSaved();
    } catch (err: any) {
      toast.error("Falha: " + (err?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <h2 className="text-base font-semibold whitespace-nowrap">
            {campaignId ? "Editar campanha" : "Nova campanha"}
          </h2>
          {isMulti && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              {targetIds.length} grupos
            </Badge>
          )}
          <div className="flex-1" />
          <Badge variant="secondary" className="text-[10px]">{nodes.length} nós</Badge>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Sidebar — paleta + config */}
            <aside className="w-64 border-r bg-muted/20 overflow-y-auto p-3 space-y-4 shrink-0">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Adicionar nó</Label>
                <div className="flex flex-col gap-1.5">
                  {(Object.keys(nodeMeta) as FlowNodeType[]).map(t => {
                    const Icon = nodeMeta[t].icon;
                    return (
                      <Button key={t} size="sm" variant="outline" className="justify-start" onClick={() => addNode(t)}>
                        <Plus className="w-3 h-3 mr-1.5" />
                        <Icon className={`w-3.5 h-3.5 mr-1.5 ${nodeMeta[t].color}`} />
                        {nodeMeta[t].label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Configuração</Label>
                <div>
                  <Label className="text-xs">Nome da campanha</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Régua educacional" />
                </div>
                <div>
                  <Label className="text-xs">Limite diário</Label>
                  <Input type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label className="text-xs">Delay entre msgs (s)</Label>
                  <Input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value) || 0)} />
                </div>
                <div className="pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Início da automação</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {scheduleEnabled ? "Agendar" : "Agora"}
                      </span>
                      <Switch
                        checked={scheduleEnabled}
                        onCheckedChange={(v) => setScheduleEnabled(v)}
                      />
                    </div>
                  </div>
                  {scheduleEnabled ? (
                    <div className="space-y-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !scheduleDate && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {scheduleDate
                              ? format(scheduleDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR })
                              : "Escolher data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={setScheduleDate}
                            disabled={(date) => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return date < today;
                            }}
                            initialFocus
                            locale={ptBR}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        A régua começa a enviar a partir desta data/hora. Os nós "Aguardar" contam a partir daí.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Ao ativar, a primeira mensagem é enviada em ~15 segundos.
                    </p>
                  )}
                </div>
              </div>
            </aside>

            {/* Canvas — lista de nós */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-0">
              {nodes.length === 0 && (
                <p className="text-xs text-muted-foreground italic p-6 border border-dashed rounded text-center">
                  Comece adicionando um nó na barra lateral.
                </p>
              )}
              {nodes.map((n, idx) => {
                const meta = nodeMeta[n.type];
                const Icon = meta.icon;
                return (
                  <Card key={n.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                        <span className="text-sm font-medium">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(n.id, -1)} disabled={idx === 0}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(n.id, 1)} disabled={idx === nodes.length - 1}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeNode(n.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {n.type === "msg" && (
                      <>
                        <Textarea
                          value={(n as MsgNode).text}
                          onChange={(e) => updateNode(n.id, { text: e.target.value } as Partial<MsgNode>)}
                          placeholder="Texto da mensagem (suporta {nome}, {grupo})"
                          rows={3}
                        />
                        <div className="flex items-center justify-between">
                          <Label className="text-xs flex items-center gap-2">
                            <Switch
                              checked={!!(n as MsgNode).mention_all}
                              onCheckedChange={(v) => updateNode(n.id, { mention_all: v } as Partial<MsgNode>)}
                            />
                            Mencionar todos (@all)
                          </Label>
                        </div>
                      </>
                    )}

                    {n.type === "wait" && (
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div>
                          <Label className="text-xs">Dias</Label>
                          <Input type="number" min={0} value={(n as WaitNode).days}
                            onChange={(e) => updateNode(n.id, { days: Number(e.target.value) || 0 } as Partial<WaitNode>)} />
                        </div>
                        <div>
                          <Label className="text-xs">Horas</Label>
                          <Input type="number" min={0} max={23} value={(n as WaitNode).hours ?? 0}
                            onChange={(e) => updateNode(n.id, { hours: Number(e.target.value) || 0 } as Partial<WaitNode>)} />
                        </div>
                        <div>
                          <Label className="text-xs">Minutos</Label>
                          <Input type="number" min={0} max={59} value={(n as WaitNode).minutes ?? 0}
                            onChange={(e) => updateNode(n.id, { minutes: Number(e.target.value) || 0 } as Partial<WaitNode>)} />
                        </div>
                        <div>
                          <Label className="text-xs">Hora do dia</Label>
                          <Input type="time" value={(n as WaitNode).time}
                            onChange={(e) => updateNode(n.id, { time: e.target.value } as Partial<WaitNode>)}
                            disabled={((n as WaitNode).hours ?? 0) > 0 || ((n as WaitNode).minutes ?? 0) > 0}
                            title={(((n as WaitNode).hours ?? 0) > 0 || ((n as WaitNode).minutes ?? 0) > 0) ? "Ignorado quando há horas/minutos configurados (usa offset relativo)" : ""} />
                        </div>
                        <Label className="text-xs flex items-center gap-2 pb-2">
                          <Switch
                            checked={!!(n as WaitNode).weekdays_only}
                            onCheckedChange={(v) => updateNode(n.id, { weekdays_only: v } as Partial<WaitNode>)}
                          />
                          Só dias úteis
                        </Label>
                      </div>
                    )}

                    {n.type === "ai" && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 text-xs">
                            {(n as AiNode).ai_source_id ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{(n as AiNode).ai_source_type}</Badge>
                                <span className="truncate">{(n as AiNode).ai_source_title}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Nenhum conteúdo selecionado</span>
                            )}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setSelectorOpenFor(n.id)}>
                            <FileText className="w-3 h-3 mr-1" /> Escolher
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!(n as AiNode).ai_source_id || previewByNode[n.id]?.loading}
                            onClick={() => previewAi(n as AiNode)}
                          >
                            {previewByNode[n.id]?.loading
                              ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              : <Eye className="w-3 h-3 mr-1" />}
                            Pré-visualizar
                          </Button>
                        </div>
                        <Textarea
                          value={(n as AiNode).ai_prompt_override ?? ""}
                          onChange={(e) => updateNode(n.id, { ai_prompt_override: e.target.value } as Partial<AiNode>)}
                          placeholder="Instrução adicional para a IA (opcional)"
                          rows={2}
                        />
                        {previewByNode[n.id]?.text && (
                          <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Preview ({previewByNode[n.id]?.provider}) — {previewByNode[n.id]?.text?.length ?? 0} chars</span>
                              <button
                                className="underline hover:text-foreground"
                                onClick={() => previewAi(n as AiNode)}
                              >
                                regenerar
                              </button>
                            </div>
                            <p className="text-xs whitespace-pre-wrap">{previewByNode[n.id]?.text}</p>
                          </div>
                        )}
                      </>
                    )}

                    {(n.type === "image" || n.type === "video" || n.type === "audio" || n.type === "document") && (
                      <>
                        <WaMediaUploader
                          kind={n.type}
                          value={(n as MediaNode).media_url}
                          fileName={(n as MediaNode).file_name}
                          onChange={(patch) => updateNode(n.id, patch as Partial<MediaNode>)}
                        />
                        {n.type !== "audio" && (
                          <Input
                            value={(n as MediaNode).caption ?? ""}
                            onChange={(e) => updateNode(n.id, { caption: e.target.value } as Partial<MediaNode>)}
                            placeholder="Legenda (opcional)"
                          />
                        )}
                      </>
                    )}

                    {n.type === "link" && (
                      <>
                        <Input
                          value={(n as LinkNode).title}
                          onChange={(e) => updateNode(n.id, { title: e.target.value } as Partial<LinkNode>)}
                          placeholder="Título do link"
                        />
                        <Input
                          value={(n as LinkNode).url}
                          onChange={(e) => updateNode(n.id, { url: e.target.value } as Partial<LinkNode>)}
                          placeholder="https://..."
                        />
                        <Textarea
                          value={(n as LinkNode).description ?? ""}
                          onChange={(e) => updateNode(n.id, { description: e.target.value } as Partial<LinkNode>)}
                          placeholder="Descrição (opcional)"
                          rows={2}
                        />
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="border-t bg-background shrink-0">
            {validation.length > 0 && (
              <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-2 space-y-0.5 max-h-24 overflow-y-auto">
                {validation.map((e, i) => (
                  <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400">• {e}</p>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-3">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                <Save className="w-3 h-3 mr-1" /> Salvar rascunho
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving || validation.length > 0}>
                {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Salvar e ativar
              </Button>
            </div>
          </div>
        )}

        <WaContentNodeSelector
          open={!!selectorOpenFor}
          onClose={() => setSelectorOpenFor(null)}
          onSelect={(type, id, title) => {
            if (selectorOpenFor) {
              updateNode(selectorOpenFor, {
                ai_source_type: type,
                ai_source_id: id,
                ai_source_title: title,
              } as Partial<AiNode>);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default WaGroupFlowBuilder;
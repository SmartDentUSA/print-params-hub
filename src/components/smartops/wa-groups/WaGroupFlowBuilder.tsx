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
  Hand, List as ListIcon, LayoutList, Instagram, Youtube,
} from "lucide-react";
import type {
  FlowNode, FlowNodeType, MsgNode, WaitNode, AiNode, MediaNode, LinkNode,
  ButtonNode, ButtonItem, ButtonItemType,
  ListNode, ListSection, ListRow,
  CarouselNode, CarouselCard, CarouselCardButton,
  SocialPostNode, SocialLinkNode, PromoSeqNode, PromoSeqMessage,
} from "./types";
import { WaContentNodeSelector } from "./WaContentNodeSelector";
import { WaMediaUploader } from "./WaMediaUploader";
import { SocialPostLinkPicker, type SocialPostPickResult } from "@/components/social/flows/SocialPostLinkPicker";

interface Props {
  open: boolean;
  groupId?: string;
  groupIds?: string[];
  campaignId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const nodeMeta: Record<FlowNodeType, { label: string; icon: any; color: string; isNew?: boolean }> = {
  msg:   { label: "Mensagem",     icon: MessageSquare, color: "text-blue-600" },
  wait:  { label: "Aguardar",     icon: Clock,         color: "text-amber-600" },
  ai:    { label: "IA + Conteúdo", icon: Sparkles,     color: "text-purple-600" },
  image: { label: "Imagem",       icon: ImageIcon,     color: "text-emerald-600" },
  video: { label: "Vídeo",        icon: Video,         color: "text-red-600" },
  audio: { label: "Áudio",        icon: Mic,           color: "text-pink-600" },
  document: { label: "Documento", icon: Paperclip,     color: "text-slate-600" },
  link:  { label: "Link",         icon: Link2,         color: "text-cyan-600" },
  button:   { label: "Botões",    icon: Hand,          color: "text-indigo-600", isNew: true },
  list:     { label: "Lista",     icon: ListIcon,      color: "text-teal-600",   isNew: true },
  carousel: { label: "Carrossel", icon: LayoutList,    color: "text-fuchsia-600", isNew: true },
  post_ig:  { label: "Postagem Instagram", icon: Instagram, color: "text-pink-600", isNew: true },
  post_yt:  { label: "Postagem YouTube",   icon: Youtube,   color: "text-red-600",  isNew: true },
  link_ig:  { label: "Link Instagram",     icon: Instagram, color: "text-pink-600", isNew: true },
  link_yt:  { label: "Link YouTube",       icon: Youtube,   color: "text-red-600",  isNew: true },
  promo_seq:{ label: "Sequência promo (7 msgs)", icon: Sparkles, color: "text-purple-600", isNew: true },
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
    case "button":
      return {
        id, type, body: "", footer: "",
        buttons: [{ type: "reply", id: crypto.randomUUID(), title: "" }],
      };
    case "list":
      return {
        id, type, title: "", body: "", footer: "", buttonText: "Ver opções",
        sections: [{ title: "Opções", rows: [{ id: crypto.randomUUID(), title: "", description: "" }] }],
      };
    case "carousel":
      return {
        id, type,
        cards: [{ body: "", image: "", buttons: [{ type: "reply", id: crypto.randomUUID(), title: "" }] }],
      };
    case "post_ig":
    case "post_yt":
      return { id, type, post_url: "", caption: "", titulo: "" } as SocialPostNode;
    case "link_ig":
    case "link_yt":
      return { id, type, url: "", caption: "", titulo: "" } as SocialLinkNode;
    case "promo_seq":
      return { id, type, produto_slug: "", produto_name: "", bucket: "aftersales", messages: [], interval_seconds: 86400 } as PromoSeqNode;
  }
}

export function WaGroupFlowBuilder({ open, groupId, groupIds, campaignId, onClose, onSaved }: Props) {
  const isMulti = !groupId && Array.isArray(groupIds) && groupIds.length > 0;
  const targetIds: string[] = isMulti ? (groupIds as string[]) : (groupId ? [groupId] : []);
  const [name, setName] = useState("");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [delaySeconds, setDelaySeconds] = useState(30);
  const [dedupeWindowDays, setDedupeWindowDays] = useState(30);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [campaignStartedAt, setCampaignStartedAt] = useState<string | null>(null);
  const [selectorOpenFor, setSelectorOpenFor] = useState<string | null>(null);
  const [postPickerFor, setPostPickerFor] = useState<{ nodeId: string; platform: "instagram" | "youtube" } | null>(null);
  const [previewByNode, setPreviewByNode] = useState<Record<string, { loading: boolean; text?: string; provider?: string; error?: string }>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      if (campaignId) {
        const { data, error } = await (supabase as any)
          .from("wa_campaigns")
          .select("name, flow_json, daily_limit, delay_seconds, dedupe_window_days, started_at, status")
          .eq("id", campaignId)
          .single();
        if (error) { toast.error(error.message); setLoading(false); return; }
        setName(data.name ?? "");
        setNodes(Array.isArray(data.flow_json) ? data.flow_json : []);
        setDailyLimit(data.daily_limit ?? 50);
        setDelaySeconds(data.delay_seconds ?? 30);
        setDedupeWindowDays(data.dedupe_window_days ?? 30);
        setCampaignStatus(data.status ?? null);
        setCampaignStartedAt(data.started_at ?? null);
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
        setCampaignStatus(null);
        setCampaignStartedAt(null);
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
      if ((n.type === "post_ig" || n.type === "post_yt") && !(n as SocialPostNode).post_url?.trim()) {
        errors.push(`${tag}: selecione uma publicação.`);
      }
      if ((n.type === "link_ig" || n.type === "link_yt") && !(n as SocialLinkNode).url?.trim()) {
        errors.push(`${tag}: selecione um link.`);
      }
      if (n.type === "promo_seq") {
        const p = n as PromoSeqNode;
        if (!p.produto_slug) errors.push(`${tag}: selecione um produto.`);
        const enabled = (p.messages ?? []).filter((m) => m.enabled && m.content.trim()).length;
        if (enabled === 0) errors.push(`${tag}: carregue as mensagens do Sistema A.`);
        if (!p.interval_seconds || p.interval_seconds < 60) errors.push(`${tag}: intervalo mínimo 60s.`);
      }
      if (n.type === "wait") {
        const w = n as WaitNode;
        if (w.mode === "absolute") {
          if (!w.absolute_at) {
            errors.push(`${tag}: escolha data e hora.`);
          } else {
            const ts = new Date(w.absolute_at).getTime();
            if (Number.isNaN(ts)) errors.push(`${tag}: data/hora inválida.`);
            else if (ts <= Date.now()) errors.push(`${tag}: data/hora deve ser futura.`);
          }
        } else {
          const d = w.days ?? 0;
          const h = w.hours ?? 0;
          const m = w.minutes ?? 0;
          if (d < 0 || h < 0 || m < 0) errors.push(`${tag}: tempo inválido.`);
          if (d === 0 && h === 0 && m === 0) errors.push(`${tag}: defina dias, horas ou minutos (>0).`);
        }
      }
      if (n.type === "button") {
        const b = n as ButtonNode;
        if (!b.body.trim()) errors.push(`${tag}: corpo obrigatório.`);
        if (!b.buttons?.length) errors.push(`${tag}: adicione ao menos um botão.`);
        const replies = b.buttons.filter(x => x.type === "reply").length;
        const ctas = b.buttons.length - replies;
        if (replies > 0 && ctas > 0) errors.push(`${tag}: não misture reply com CTA/PIX.`);
        if (replies > 3) errors.push(`${tag}: máximo 3 botões de reply.`);
        if (ctas > 1) errors.push(`${tag}: apenas 1 botão CTA/PIX por mensagem.`);
        b.buttons.forEach((bt, i) => {
          if (!bt.title.trim()) errors.push(`${tag}: botão ${i + 1} sem título.`);
          if (bt.type === "cta_url" && !bt.url?.trim()) errors.push(`${tag}: botão ${i + 1} URL obrigatória.`);
          if (bt.type === "cta_copy" && !bt.copyCode?.trim()) errors.push(`${tag}: botão ${i + 1} código copiar obrigatório.`);
          if (bt.type === "cta_call" && !bt.phoneNumber?.trim()) errors.push(`${tag}: botão ${i + 1} telefone obrigatório.`);
          if (bt.type === "pix" && !bt.pixKey?.trim()) errors.push(`${tag}: botão ${i + 1} chave PIX obrigatória.`);
        });
      }
      if (n.type === "list") {
        const l = n as ListNode;
        if (!l.body.trim()) errors.push(`${tag}: corpo obrigatório.`);
        if (!l.buttonText.trim()) errors.push(`${tag}: texto do botão obrigatório.`);
        if (l.buttonText.length > 20) errors.push(`${tag}: texto do botão até 20 caracteres.`);
        if (!l.sections?.length) errors.push(`${tag}: adicione ao menos uma seção.`);
        if (l.sections.length > 10) errors.push(`${tag}: máximo 10 seções.`);
        l.sections.forEach((s, si) => {
          if (!s.rows?.length) errors.push(`${tag}: seção ${si + 1} sem itens.`);
          if (s.rows.length > 10) errors.push(`${tag}: seção ${si + 1} máximo 10 itens.`);
          s.rows.forEach((r, ri) => {
            if (!r.title.trim()) errors.push(`${tag}: seção ${si + 1} item ${ri + 1} sem título.`);
          });
        });
      }
      if (n.type === "carousel") {
        const c = n as CarouselNode;
        if (!c.cards?.length) errors.push(`${tag}: adicione ao menos um card.`);
        if (c.cards.length > 10) errors.push(`${tag}: máximo 10 cards.`);
        c.cards.forEach((card, ci) => {
          if (!card.body.trim()) errors.push(`${tag}: card ${ci + 1} sem corpo.`);
          if ((card.buttons?.length ?? 0) > 3) errors.push(`${tag}: card ${ci + 1} máximo 3 botões.`);
          card.buttons?.forEach((bt, bi) => {
            if (!bt.title.trim()) errors.push(`${tag}: card ${ci + 1} botão ${bi + 1} sem título.`);
            if (bt.type === "cta_url" && !bt.url?.trim()) errors.push(`${tag}: card ${ci + 1} botão ${bi + 1} URL obrigatória.`);
          });
        });
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
    const isIncrementalEdit =
      !!campaignId &&
      (
        (campaignStartedAt && new Date(campaignStartedAt).getTime() <= Date.now()) ||
        ["active", "paused", "finished", "error"].includes(campaignStatus ?? "")
      );
    let schedIso: string | null = null;
    if (!isIncrementalEdit) {
      const sched = computeStartedAt();
      if (sched.error) { toast.error(sched.error); return; }
      schedIso = sched.iso;
    }
    setSaving(true);
    try {
      let cid = campaignId;
      const payload: any = {
        group_id: isMulti ? null : groupId,
        name: name.trim(),
        flow_json: nodes,
        daily_limit: dailyLimit,
        delay_seconds: delaySeconds,
        dedupe_window_days: dedupeWindowDays,
      };
      if (!isIncrementalEdit) {
        payload.started_at = schedIso;
      }
      if (cid) {
        payload.status = "draft";
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
                        <span className="flex-1 text-left">{nodeMeta[t].label}</span>
                        {nodeMeta[t].isNew && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">Novo</Badge>
                        )}
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
                <div>
                  <Label className="text-xs">Janela de dedupe (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={dedupeWindowDays}
                    onChange={(e) => setDedupeWindowDays(Number(e.target.value) || 1)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Impede reenvio do mesmo conteúdo ao mesmo grupo dentro desta janela (mesmo em outras campanhas).
                  </p>
                </div>
                <div className="pt-3 border-t space-y-2">
                  {campaignId && (
                    (campaignStartedAt && new Date(campaignStartedAt).getTime() <= Date.now()) ||
                    ["active", "paused", "finished", "error"].includes(campaignStatus ?? "")
                  ) ? (
                    <div className="rounded border border-dashed p-2 bg-muted/30">
                      <Label className="text-xs">Edição incremental</Label>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                        A campanha já foi iniciada. Novos nós serão enfileirados após o último envio, seguindo a sequência de "Aguardar". Nós já enviados não serão reenviados.
                      </p>
                    </div>
                  ) : (
                  <>
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
                  </>
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
                      <WaitNodeEditor node={n as WaitNode} onChange={(patch) => updateNode(n.id, patch)} />
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

                    {n.type === "button" && (
                      <ConfigButton
                        node={n as ButtonNode}
                        onChange={(patch) => updateNode(n.id, patch as Partial<ButtonNode>)}
                      />
                    )}

                    {n.type === "list" && (
                      <ConfigList
                        node={n as ListNode}
                        onChange={(patch) => updateNode(n.id, patch as Partial<ListNode>)}
                      />
                    )}

                    {n.type === "carousel" && (
                      <ConfigCarousel
                        node={n as CarouselNode}
                        onChange={(patch) => updateNode(n.id, patch as Partial<CarouselNode>)}
                      />
                    )}

                    {(n.type === "post_ig" || n.type === "post_yt") && (() => {
                      const sp = n as SocialPostNode;
                      const platform: "instagram" | "youtube" = n.type === "post_ig" ? "instagram" : "youtube";
                      return (
                        <div className="space-y-2">
                          {sp.post_url ? (
                            <div className="flex gap-2.5 p-2 rounded-md border bg-muted/30">
                              {sp.thumbnail_url ? (
                                <img src={sp.thumbnail_url} alt="" loading="lazy" className="w-16 h-16 rounded object-cover bg-muted shrink-0" />
                              ) : (
                                <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                                  {platform === "instagram"
                                    ? <Instagram className="w-5 h-5 text-pink-600" />
                                    : <Youtube className="w-5 h-5 text-red-600" />}
                                </div>
                              )}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-xs font-medium truncate">{sp.titulo || "Publicação"}</div>
                                <a href={sp.post_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline truncate block">
                                  {sp.post_url}
                                </a>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setPostPickerFor({ nodeId: n.id, platform })}>
                                Trocar
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="w-full" onClick={() => setPostPickerFor({ nodeId: n.id, platform })}>
                              {platform === "instagram"
                                ? <Instagram className="w-3.5 h-3.5 mr-1.5 text-pink-600" />
                                : <Youtube className="w-3.5 h-3.5 mr-1.5 text-red-600" />}
                              Selecionar publicação do {platform === "instagram" ? "Instagram" : "YouTube"}
                            </Button>
                          )}
                          <Textarea
                            value={sp.caption ?? ""}
                            onChange={(e) => updateNode(n.id, { caption: e.target.value } as Partial<SocialPostNode>)}
                            placeholder="Mensagem a enviar junto com o link (editável)"
                            rows={3}
                          />
                        </div>
                      );
                    })()}

                    {(n.type === "link_ig" || n.type === "link_yt") && (() => {
                      const ln = n as SocialLinkNode;
                      const platform: "instagram" | "youtube" = n.type === "link_ig" ? "instagram" : "youtube";
                      return (
                        <div className="space-y-2">
                          {ln.url ? (
                            <div className="flex gap-2.5 p-2 rounded-md border bg-muted/30">
                              {ln.thumbnail_url ? (
                                <img src={ln.thumbnail_url} alt="" loading="lazy" className="w-14 h-14 rounded object-cover bg-muted shrink-0" />
                              ) : (
                                <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                                  {platform === "instagram"
                                    ? <Instagram className="w-5 h-5 text-pink-600" />
                                    : <Youtube className="w-5 h-5 text-red-600" />}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{ln.titulo || "Link"}</div>
                                <a href={ln.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline truncate block">{ln.url}</a>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setPostPickerFor({ nodeId: n.id, platform })}>Trocar</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="w-full" onClick={() => setPostPickerFor({ nodeId: n.id, platform })}>
                              {platform === "instagram"
                                ? <Instagram className="w-3.5 h-3.5 mr-1.5 text-pink-600" />
                                : <Youtube className="w-3.5 h-3.5 mr-1.5 text-red-600" />}
                              Selecionar link do {platform === "instagram" ? "Instagram" : "YouTube"}
                            </Button>
                          )}
                          <Textarea
                            value={ln.caption ?? ""}
                            onChange={(e) => updateNode(n.id, { caption: e.target.value } as Partial<SocialLinkNode>)}
                            placeholder="Mensagem que acompanha o link (editável)"
                            rows={3}
                          />
                        </div>
                      );
                    })()}

                    {n.type === "promo_seq" && (
                      <PromoSeqInspector
                        node={n as PromoSeqNode}
                        onChange={(patch) => updateNode(n.id, patch as Partial<PromoSeqNode>)}
                      />
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

        <SocialPostLinkPicker
          open={!!postPickerFor}
          onOpenChange={(o) => { if (!o) setPostPickerFor(null); }}
          platform={postPickerFor?.platform}
          onSelect={(p: SocialPostPickResult) => {
            if (!postPickerFor) return;
            const target = nodes.find((nn) => nn.id === postPickerFor.nodeId);
            if (target && (target.type === "link_ig" || target.type === "link_yt")) {
              updateNode(postPickerFor.nodeId, {
                url: p.url,
                caption: p.caption ?? "",
                thumbnail_url: p.thumbnail_url,
                titulo: p.titulo,
              } as Partial<SocialLinkNode>);
            } else {
              updateNode(postPickerFor.nodeId, {
                social_post_id: p.post_id,
                post_url: p.url,
                caption: p.caption ?? "",
                thumbnail_url: p.thumbnail_url,
                titulo: p.titulo,
              } as Partial<SocialPostNode>);
            }
            setPostPickerFor(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default WaGroupFlowBuilder;

// ============== Config: Sequência promo (7 msgs) ==============
export function PromoSeqInspector({ node, onChange }: { node: PromoSeqNode; onChange: (p: Partial<PromoSeqNode>) => void }) {
  type ProdOpt = { slug: string; name: string; counts: { aftersales: number; cs: number }; raw: any };
  const [productOptions, setProductOptions] = useState<ProdOpt[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (productOptions.length > 0) return;
    setLoadingProducts(true);
    fetch("https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full?limit=500&include=products", {
      method: "GET",
    })
      .then((r) => r.json())
      .then((j) => {
        const opts: ProdOpt[] = ((j?.products ?? []) as any[])
          .map((p) => {
            const validCount = (arr: any) => (Array.isArray(arr) ? arr.filter((m) => {
              const c = String(m?.message_content ?? m?.content ?? "").trim();
              return c && c !== "Digite sua mensagem aqui...";
            }).length : 0);
            return {
              slug: String(p?.slug ?? ""),
              name: String(p?.name ?? p?.slug ?? ""),
              counts: {
                aftersales: validCount(p?.messages?.aftersales),
                cs: validCount(p?.messages?.cs),
              },
              raw: p,
            };
          })
          .filter((x) => x.slug)
          .sort((a, b) => a.name.localeCompare(b.name));
        setProductOptions(opts);
      })
      .catch((e) => toast.error("Falha ao listar produtos: " + (e?.message ?? e)))
      .finally(() => setLoadingProducts(false));
  }, [productOptions.length]);

  const filteredOptions = productOptions.filter((p) => (p.counts as any)[node.bucket] > 0);
  const totalInBucket = filteredOptions.length;

  const loadFromCache = (slug: string) => {
    const prod = productOptions.find((p) => p.slug === slug)?.raw;
    const raw = prod?.messages?.[node.bucket] ?? [];
    const mapped: PromoSeqMessage[] = (raw as any[])
      .map((m, i) => ({
        order: Number(m?.message_order ?? i + 1),
        content: String(m?.message_content ?? m?.content ?? ""),
        enabled: m?.is_active !== false,
      }))
      .filter((m) => m.content.trim() && m.content.trim() !== "Digite sua mensagem aqui...")
      .sort((a, b) => a.order - b.order);
    onChange({ messages: mapped, produto_name: prod?.name ?? slug, produto_slug: slug });
  };

  const loadMessages = async () => {
    if (!node.produto_slug) { toast.error("Selecione um produto"); return; }
    setLoadingMessages(true);
    try {
      const res = await fetch("https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full?limit=500&include=products", {
        method: "GET",
      });
      const json = await res.json();
      const prod = (json?.products ?? []).find((p: any) => p?.slug === node.produto_slug);
      const raw = prod?.messages?.[node.bucket] ?? [];
      const mapped: PromoSeqMessage[] = (raw as any[])
        .map((m, i) => ({
          order: Number(m?.message_order ?? i + 1),
          content: String(m?.message_content ?? m?.content ?? ""),
          enabled: m?.is_active !== false,
        }))
        .filter((m) => m.content.trim() && m.content.trim() !== "Digite sua mensagem aqui...")
        .sort((a, b) => a.order - b.order);
      onChange({ messages: mapped, produto_name: prod?.name ?? node.produto_slug });
      if (mapped.length === 0) toast.warning(`Nenhuma mensagem em ${node.bucket} para este produto.`);
      else toast.success(`${mapped.length} mensagem(ns) carregada(s)`);
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? e));
    } finally {
      setLoadingMessages(false);
    }
  };

  const toggleMsg = (order: number) => {
    onChange({ messages: node.messages.map((m) => m.order === order ? { ...m, enabled: !m.enabled } : m) });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Bucket</Label>
        <Select value={node.bucket} onValueChange={(v) => {
          const newBucket = v as PromoSeqNode["bucket"];
          const stillValid = productOptions.find((p) => p.slug === node.produto_slug && (p.counts as any)[newBucket] > 0);
          onChange({
            bucket: newBucket,
            messages: [],
            produto_slug: stillValid ? node.produto_slug : "",
            produto_name: stillValid ? node.produto_name : "",
          });
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aftersales">Pós-venda (7 promo)</SelectItem>
            <SelectItem value="cs">CS / Atendimento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">
          Produto (Sistema A){" "}
          <span className="text-muted-foreground">· {totalInBucket} com mensagens</span>
        </Label>
        <Select value={node.produto_slug} onValueChange={(v) => loadFromCache(v)}>
          <SelectTrigger>
            <SelectValue placeholder={loadingProducts ? "Carregando..." : (totalInBucket === 0 ? "Nenhum produto com mensagens neste bucket" : "Selecione...")} />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {filteredOptions.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.name} · {(p.counts as any)[node.bucket]} msgs
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Intervalo entre mensagens (segundos)</Label>
        <Input type="number" value={node.interval_seconds} min={60} onChange={(e) => onChange({ interval_seconds: Number(e.target.value) })} />
        <p className="text-[10px] text-muted-foreground mt-0.5">86400 = 1 dia · 3600 = 1 hora</p>
      </div>
      <Button variant="ghost" size="sm" className="w-full" onClick={loadMessages} disabled={!node.produto_slug || loadingMessages}>
        {loadingMessages ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
        Recarregar do Sistema A
      </Button>
      {node.messages.length === 0 ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
          {totalInBucket === 0
            ? `Nenhum produto possui mensagens cadastradas em "${node.bucket}" no Sistema A. Cadastre no painel do Sistema A.`
            : "Selecione um produto acima — as mensagens carregam automaticamente."}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {node.messages.map((m) => (
            <label key={m.order} className="flex gap-2 p-2 rounded border border-border text-xs cursor-pointer hover:bg-accent/50">
              <input type="checkbox" checked={m.enabled} onChange={() => toggleMsg(m.order)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">Mensagem {m.order}</div>
                <div className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{m.content}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== Config: Button ==============
function ConfigButton({ node, onChange }: { node: ButtonNode; onChange: (p: Partial<ButtonNode>) => void }) {
  const setButtons = (buttons: ButtonItem[]) => onChange({ buttons });
  const updateBtn = (i: number, patch: Partial<ButtonItem>) =>
    setButtons(node.buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const addBtn = () =>
    setButtons([...node.buttons, { type: "reply", id: crypto.randomUUID(), title: "" }]);
  const removeBtn = (i: number) => setButtons(node.buttons.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <Textarea
        value={node.body}
        onChange={(e) => onChange({ body: e.target.value })}
        placeholder="Corpo da mensagem"
        rows={2}
      />
      <Input
        value={node.footer ?? ""}
        onChange={(e) => onChange({ footer: e.target.value })}
        placeholder="Rodapé (opcional)"
      />
      <div className="space-y-2 pt-1">
        {node.buttons.map((b, i) => (
          <div key={b.id} className="rounded border p-2 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <Select value={b.type} onValueChange={(v) => updateBtn(i, { type: v as ButtonItemType })}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reply">Reply</SelectItem>
                  <SelectItem value="cta_url">CTA URL</SelectItem>
                  <SelectItem value="cta_copy">CTA Copiar</SelectItem>
                  <SelectItem value="cta_call">CTA Ligar</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="h-8"
                value={b.title}
                onChange={(e) => updateBtn(i, { title: e.target.value })}
                placeholder="Título do botão"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeBtn(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            {b.type === "cta_url" && (
              <Input className="h-8" value={b.url ?? ""} onChange={(e) => updateBtn(i, { url: e.target.value })} placeholder="https://..." />
            )}
            {b.type === "cta_copy" && (
              <Input className="h-8" value={b.copyCode ?? ""} onChange={(e) => updateBtn(i, { copyCode: e.target.value })} placeholder="Código a copiar" />
            )}
            {b.type === "cta_call" && (
              <Input className="h-8" value={b.phoneNumber ?? ""} onChange={(e) => updateBtn(i, { phoneNumber: e.target.value })} placeholder="+5511999999999" />
            )}
            {b.type === "pix" && (
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-8" value={b.pixKey ?? ""} onChange={(e) => updateBtn(i, { pixKey: e.target.value })} placeholder="Chave PIX" />
                <Input className="h-8" type="number" value={b.pixAmount ?? ""} onChange={(e) => updateBtn(i, { pixAmount: Number(e.target.value) || undefined })} placeholder="Valor (R$)" />
              </div>
            )}
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addBtn}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar botão
        </Button>
      </div>
    </div>
  );
}

// ============== Config: List ==============
function ConfigList({ node, onChange }: { node: ListNode; onChange: (p: Partial<ListNode>) => void }) {
  const setSections = (sections: ListSection[]) => onChange({ sections });
  const updateSection = (si: number, patch: Partial<ListSection>) =>
    setSections(node.sections.map((s, i) => i === si ? { ...s, ...patch } : s));
  const addSection = () =>
    setSections([...node.sections, { title: "", rows: [{ id: crypto.randomUUID(), title: "" }] }]);
  const removeSection = (si: number) => setSections(node.sections.filter((_, i) => i !== si));
  const updateRow = (si: number, ri: number, patch: Partial<ListRow>) =>
    updateSection(si, { rows: node.sections[si].rows.map((r, i) => i === ri ? { ...r, ...patch } : r) });
  const addRow = (si: number) =>
    updateSection(si, { rows: [...node.sections[si].rows, { id: crypto.randomUUID(), title: "" }] });
  const removeRow = (si: number, ri: number) =>
    updateSection(si, { rows: node.sections[si].rows.filter((_, i) => i !== ri) });

  return (
    <div className="space-y-2">
      <Input value={node.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="Título (opcional)" />
      <Textarea value={node.body} onChange={(e) => onChange({ body: e.target.value })} placeholder="Corpo da mensagem" rows={2} />
      <Input value={node.footer ?? ""} onChange={(e) => onChange({ footer: e.target.value })} placeholder="Rodapé (opcional)" />
      <Input
        value={node.buttonText}
        onChange={(e) => onChange({ buttonText: e.target.value })}
        placeholder="Texto do botão (até 20 chars)"
        maxLength={20}
      />
      <div className="space-y-2 pt-1">
        {node.sections.map((s, si) => (
          <div key={si} className="rounded border p-2 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <Input
                className="h-8"
                value={s.title}
                onChange={(e) => updateSection(si, { title: e.target.value })}
                placeholder={`Seção ${si + 1}`}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeSection(si)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-1.5 pl-2">
              {s.rows.map((r, ri) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Input className="h-8" value={r.title} onChange={(e) => updateRow(si, ri, { title: e.target.value })} placeholder="Título do item" />
                  <Input className="h-8" value={r.description ?? ""} onChange={(e) => updateRow(si, ri, { description: e.target.value })} placeholder="Descrição (opcional)" />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeRow(si, ri)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => addRow(si)}>
                <Plus className="w-3 h-3 mr-1" /> Item
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addSection}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar seção
        </Button>
      </div>
    </div>
  );
}

// ============== Config: Carousel ==============
function ConfigCarousel({ node, onChange }: { node: CarouselNode; onChange: (p: Partial<CarouselNode>) => void }) {
  const setCards = (cards: CarouselCard[]) => onChange({ cards });
  const updateCard = (ci: number, patch: Partial<CarouselCard>) =>
    setCards(node.cards.map((c, i) => i === ci ? { ...c, ...patch } : c));
  const addCard = () =>
    setCards([...node.cards, { body: "", image: "", buttons: [{ type: "reply", id: crypto.randomUUID(), title: "" }] }]);
  const removeCard = (ci: number) => setCards(node.cards.filter((_, i) => i !== ci));
  const updateBtn = (ci: number, bi: number, patch: Partial<CarouselCardButton>) =>
    updateCard(ci, { buttons: node.cards[ci].buttons.map((b, i) => i === bi ? { ...b, ...patch } : b) });
  const addBtn = (ci: number) =>
    updateCard(ci, { buttons: [...node.cards[ci].buttons, { type: "reply", id: crypto.randomUUID(), title: "" }] });
  const removeBtn = (ci: number, bi: number) =>
    updateCard(ci, { buttons: node.cards[ci].buttons.filter((_, i) => i !== bi) });

  return (
    <div className="space-y-2">
      {node.cards.map((card, ci) => (
        <div key={ci} className="rounded border p-2 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">Card #{ci + 1}</Badge>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeCard(ci)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <WaMediaUploader
            kind="image"
            value={card.image ?? ""}
            onChange={({ media_url }) => updateCard(ci, { image: media_url })}
          />
          <Textarea value={card.body} onChange={(e) => updateCard(ci, { body: e.target.value })} placeholder="Texto do card" rows={2} />
          <div className="space-y-1.5 pl-2">
            {card.buttons.map((b, bi) => (
              <div key={b.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Select value={b.type} onValueChange={(v) => updateBtn(ci, bi, { type: v as CarouselCardButton["type"] })}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reply">Reply</SelectItem>
                      <SelectItem value="cta_url">CTA URL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="h-8" value={b.title} onChange={(e) => updateBtn(ci, bi, { title: e.target.value })} placeholder="Título" />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeBtn(ci, bi)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {b.type === "cta_url" && (
                  <Input className="h-8" value={b.url ?? ""} onChange={(e) => updateBtn(ci, bi, { url: e.target.value })} placeholder="https://..." />
                )}
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => addBtn(ci)} disabled={card.buttons.length >= 3}>
              <Plus className="w-3 h-3 mr-1" /> Botão
            </Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addCard} disabled={node.cards.length >= 10}>
        <Plus className="w-3 h-3 mr-1" /> Adicionar card
      </Button>
    </div>
  );
}

function WaitNodeEditor({ node, onChange }: { node: WaitNode; onChange: (patch: Partial<WaitNode>) => void }) {
  const mode = node.mode ?? "relative";

  const abs = node.absolute_at ? new Date(node.absolute_at) : undefined;
  const absDate = abs && !Number.isNaN(abs.getTime()) ? abs : undefined;
  const absTime = absDate
    ? `${String(absDate.getHours()).padStart(2, "0")}:${String(absDate.getMinutes()).padStart(2, "0")}`
    : "09:00";

  const setAbsolute = (date: Date | undefined, time: string) => {
    if (!date) {
      onChange({ absolute_at: undefined } as Partial<WaitNode>);
      return;
    }
    const [hh, mm] = (time || "09:00").split(":").map(Number);
    const d = new Date(date);
    d.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
    onChange({ absolute_at: d.toISOString() } as Partial<WaitNode>);
  };

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-md border p-0.5 text-xs">
        <button
          type="button"
          className={cn(
            "px-2.5 py-1 rounded-sm transition-colors",
            mode === "relative" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange({ mode: "relative" } as Partial<WaitNode>)}
        >
          Relativo
        </button>
        <button
          type="button"
          className={cn(
            "px-2.5 py-1 rounded-sm transition-colors",
            mode === "absolute" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange({ mode: "absolute" } as Partial<WaitNode>)}
        >
          Data/hora exatos
        </button>
      </div>

      {mode === "absolute" ? (
        <div className="grid grid-cols-2 gap-2 items-end">
          <div>
            <Label className="text-xs">Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !absDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {absDate ? format(absDate, "PPP", { locale: ptBR }) : "Escolher data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={absDate}
                  onSelect={(d) => setAbsolute(d, absTime)}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs">Hora</Label>
            <Input
              type="time"
              value={absTime}
              onChange={(e) => setAbsolute(absDate, e.target.value)}
            />
          </div>
          {absDate && (
            <div className="col-span-2 text-[11px] text-muted-foreground">
              Envio agendado para{" "}
              <span className="font-medium text-foreground">
                {format(new Date(node.absolute_at!), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2 items-end">
          <div>
            <Label className="text-xs">Dias</Label>
            <Input
              type="number"
              min={0}
              value={node.days}
              onChange={(e) => onChange({ days: Number(e.target.value) || 0 } as Partial<WaitNode>)}
            />
          </div>
          <div>
            <Label className="text-xs">Horas</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={node.hours ?? 0}
              onChange={(e) => onChange({ hours: Number(e.target.value) || 0 } as Partial<WaitNode>)}
            />
          </div>
          <div>
            <Label className="text-xs">Minutos</Label>
            <Input
              type="number"
              min={0}
              max={59}
              value={node.minutes ?? 0}
              onChange={(e) => onChange({ minutes: Number(e.target.value) || 0 } as Partial<WaitNode>)}
            />
          </div>
          <div>
            <Label className="text-xs">Hora do dia</Label>
            <Input
              type="time"
              value={node.time}
              onChange={(e) => onChange({ time: e.target.value } as Partial<WaitNode>)}
              disabled={(node.hours ?? 0) > 0 || (node.minutes ?? 0) > 0}
              title={((node.hours ?? 0) > 0 || (node.minutes ?? 0) > 0) ? "Ignorado quando há horas/minutos configurados (usa offset relativo)" : ""}
            />
          </div>
          <Label className="text-xs flex items-center gap-2 pb-2">
            <Switch
              checked={!!node.weekdays_only}
              onCheckedChange={(v) => onChange({ weekdays_only: v } as Partial<WaitNode>)}
            />
            Só dias úteis
          </Label>
        </div>
      )}
    </div>
  );
}
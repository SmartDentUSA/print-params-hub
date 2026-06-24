import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Send } from "lucide-react";
import { WaMediaUploader } from "./WaMediaUploader";
import { WaGroupMultiSelect } from "./WaGroupMultiSelect";
import { CampaignLinkPicker } from "../CampaignLinkPicker";

type MsgType = "msg" | "image" | "video" | "audio" | "document" | "link";

interface Props {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  selectedGroupJids?: string[];
  selectedGroupNames?: string[];
  /** Quando true, o modal mostra um passo de segmentação (picker) incluindo grupos não-admin. */
  pickerMode?: boolean;
  instanceFilter?: string;
  /** Valores iniciais para pré-preencher o blast (ex.: vindos de uma publicação histórica). */
  initial?: {
    type?: MsgType;
    text?: string;
    mediaUrl?: string;
    caption?: string;
    linkTitle?: string;
    linkUrl?: string;
    linkDesc?: string;
  };
}

export function WaGroupBlastModal({
  open, onClose, onSent,
  selectedGroupJids: presetJids = [],
  selectedGroupNames: presetNames = [],
  pickerMode = false,
  instanceFilter,
  initial,
}: Props) {
  const [type, setType] = useState<MsgType>("msg");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [whenMode, setWhenMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  // Picker state (used only when pickerMode=true)
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickedJids, setPickedJids] = useState<string[]>([]);
  const [pickedNames, setPickedNames] = useState<string[]>([]);
  // Dedupe override + última lista de grupos bloqueados
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [blockedDup, setBlockedDup] = useState<{ group_jid: string; name: string; last_sent_at: string | null }[]>([]);

  // Aplica valores iniciais quando o modal abre
  useEffect(() => {
    if (!open || !initial) return;
    if (initial.type) setType(initial.type);
    if (initial.text !== undefined) setText(initial.text);
    if (initial.mediaUrl !== undefined) setMediaUrl(initial.mediaUrl);
    if (initial.caption !== undefined) setCaption(initial.caption);
    if (initial.linkTitle !== undefined) setLinkTitle(initial.linkTitle);
    if (initial.linkUrl !== undefined) setLinkUrl(initial.linkUrl);
    if (initial.linkDesc !== undefined) setLinkDesc(initial.linkDesc);
  }, [open, initial]);

  const selectedGroupJids = pickerMode ? pickedJids : presetJids;
  const selectedGroupNames = pickerMode ? pickedNames : presetNames;

  const reset = () => {
    setType("msg"); setText(""); setMediaUrl(""); setFileName(undefined);
    setCaption(""); setLinkTitle(""); setLinkUrl(""); setLinkDesc("");
    setWhenMode("now"); setScheduledAt("");
    setPickedIds([]); setPickedJids([]); setPickedNames([]);
    setAllowDuplicate(false); setBlockedDup([]);
  };

  const buildContent = (): Record<string, unknown> | null => {
    switch (type) {
      case "msg":
        if (!text.trim()) { toast.error("Texto vazio"); return null; }
        return { text };
      case "image":
      case "video":
      case "audio":
      case "document":
        if (!mediaUrl.trim()) { toast.error("Envie o arquivo"); return null; }
        return { media_url: mediaUrl, caption, file_name: fileName ?? null };
      case "link":
        if (!linkUrl.trim() || !linkTitle.trim()) { toast.error("Título e URL obrigatórios"); return null; }
        return { title: linkTitle, description: linkDesc, url: linkUrl };
    }
  };

  const handleSend = async () => {
    if (selectedGroupJids.length === 0) { toast.error("Nenhum grupo selecionado"); return; }
    const content = buildContent();
    if (!content) return;

    let scheduledIso: string | undefined;
    if (whenMode === "scheduled") {
      if (!scheduledAt) { toast.error("Escolha a data/hora"); return; }
      const dt = new Date(scheduledAt);
      if (Number.isNaN(dt.getTime()) || dt.getTime() < Date.now()) {
        toast.error("Data/hora inválida"); return;
      }
      scheduledIso = dt.toISOString();
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-group-blast", {
        body: {
          group_jids: selectedGroupJids,
          message_type: type,
          content,
          scheduled_at: scheduledIso,
          campaign_name: `Blast ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          allow_duplicate: allowDuplicate,
        },
      });
      if (error) {
        let serverMsg = error.message;
        let serverPayload: any = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            serverPayload = j;
            if (j?.error) serverMsg = j.error;
          } else if (ctx && typeof ctx.text === "function") {
            const t = await ctx.text();
            if (t) serverMsg = t;
          }
        } catch { /* keep error.message */ }
        if (serverPayload?.error === "duplicate_blocked" && Array.isArray(serverPayload.skipped_duplicates)) {
          setBlockedDup(serverPayload.skipped_duplicates);
          toast.error(`Todos os ${serverPayload.skipped_duplicates.length} grupos já receberam essa mensagem (janela ${serverPayload.dedupe_window_days}d). Marque "Reenviar mesmo assim" para forçar.`);
          return;
        }
        throw new Error(serverMsg);
      }
      if (!data?.ok) throw new Error(data?.error ?? "Falha desconhecida");
      const skipped = Array.isArray(data.skipped_duplicates) ? data.skipped_duplicates.length : 0;
      const msg = `Blast agendado para ${data.groups} grupos — ${data.queued} mensagens na fila`
        + (skipped > 0 ? ` (${skipped} bloqueado${skipped === 1 ? "" : "s"} por dedupe)` : "");
      toast.success(msg);
      reset();
      onSent?.();
      onClose();
    } catch (err: any) {
      toast.error("Falha no blast: " + (err?.message ?? String(err)));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            Envio pontual {pickerMode ? "(wizard)" : "—"} {selectedGroupJids.length} grupo{selectedGroupJids.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {pickerMode
              ? "Selecione os grupos abaixo (incluindo onde a instância não é admin) para o envio único."
              : `${selectedGroupNames.slice(0, 5).join(", ")}${selectedGroupNames.length > 5 ? ` e mais ${selectedGroupNames.length - 5}` : ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {pickerMode && (
            <div>
              <Label className="text-xs">Segmentação</Label>
              <WaGroupMultiSelect
                selectedIds={pickedIds}
                instanceFilter={instanceFilter}
                includeNonAdmin
                onChange={(ids, jids, names) => {
                  setPickedIds(ids); setPickedJids(jids); setPickedNames(names);
                }}
              />
            </div>
          )}

          <div>
            <Label className="text-xs">Tipo de mensagem</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as MsgType)} className="grid grid-cols-3 gap-2 mt-1">
              {(["msg","image","video","audio","document","link"] as MsgType[]).map(t => (
                <Label key={t} className="flex items-center gap-2 border rounded px-2 py-1.5 cursor-pointer text-xs hover:bg-muted/40">
                  <RadioGroupItem value={t} />
                  {t === "msg" ? "Texto" : t === "image" ? "Imagem" : t === "video" ? "Vídeo" : t === "audio" ? "Áudio" : t === "document" ? "Documento" : "Link"}
                </Label>
              ))}
            </RadioGroup>
          </div>

          {type === "msg" && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mensagem</Label>
                <CampaignLinkPicker
                  channel="whatsapp_groups"
                  onInsert={(t) => setText((p) => (p ? p + " " : "") + t)}
                />
              </div>
              <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto do blast..." />
            </div>
          )}

          {(type === "image" || type === "video" || type === "audio" || type === "document") && (
            <>
              <WaMediaUploader
                kind={type}
                value={mediaUrl}
                fileName={fileName}
                onChange={(patch) => {
                  if (patch.media_url !== undefined) setMediaUrl(patch.media_url ?? "");
                  if (patch.file_name !== undefined) setFileName(patch.file_name ?? undefined);
                }}
              />
              {type !== "audio" && (
                <div>
                  <Label className="text-xs">Legenda (opcional)</Label>
                  <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              )}
            </>
          )}

          {type === "link" && (
            <div className="space-y-2">
              <Input placeholder="Título" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
              <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              <Textarea rows={2} placeholder="Descrição (opcional)" value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} />
            </div>
          )}

          <div>
            <Label className="text-xs">Agendamento</Label>
            <RadioGroup value={whenMode} onValueChange={(v) => setWhenMode(v as "now" | "scheduled")} className="space-y-1 mt-1">
              <Label className="flex items-center gap-2 text-xs cursor-pointer">
                <RadioGroupItem value="now" />
                Agora (em 30 segundos)
              </Label>
              <Label className="flex items-center gap-2 text-xs cursor-pointer">
                <RadioGroupItem value="scheduled" />
                Data/hora específica
              </Label>
            </RadioGroup>
            {whenMode === "scheduled" && (
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2"
              />
            )}
          </div>
        </div>

        {blockedDup.length > 0 && (
          <div className="mx-6 mb-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-xs p-3 space-y-2">
            <div className="font-semibold">
              {blockedDup.length} grupo{blockedDup.length === 1 ? "" : "s"} já receberam esta mensagem
            </div>
            <ul className="max-h-32 overflow-auto space-y-0.5">
              {blockedDup.slice(0, 8).map((b) => (
                <li key={b.group_jid} className="flex justify-between gap-2">
                  <span className="truncate">{b.name || b.group_jid}</span>
                  <span className="opacity-70 shrink-0">
                    {b.last_sent_at ? new Date(b.last_sent_at).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </li>
              ))}
              {blockedDup.length > 8 && <li className="opacity-70">…e mais {blockedDup.length - 8}</li>}
            </ul>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(e) => setAllowDuplicate(e.target.checked)}
              />
              Reenviar mesmo assim (ignora a trava de duplicidade)
            </Label>
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-background shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={sending}>Cancelar</Button>
          <div className="flex-1" />
          <Button onClick={handleSend} disabled={sending || selectedGroupJids.length === 0}>
            {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
            Enviar para {selectedGroupJids.length} grupo{selectedGroupJids.length === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WaGroupBlastModal;
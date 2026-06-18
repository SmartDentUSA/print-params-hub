import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Send, Image as ImageIcon, Video, MessageSquare, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type FactoryStatus = "processando" | "pronto" | "publicando" | "concluido" | "erro" | string;

interface FactoryRun {
  id: string;
  status: string;
  turma_id: string;
  published_at?: string | null;
  created_at: string;
}

interface FactoryAsset {
  id: string;
  run_id: string;
  asset_type: string;
  participant_name?: string | null;
  participant_phone?: string | null;
  participant_instagram?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  whatsapp_text?: string | null;
  transcription?: string | null;
  status: string;
  wa_sent_at?: string | null;
  published_at?: string | null;
  publish_error?: string | null;
  wa_error?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turmaId: string;
  turmaLabel?: string;
  factoryStatus?: FactoryStatus | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  processando: { label: "Processando", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  pronto: { label: "Pronto para publicar", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  publicando: { label: "Publicando", cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" },
  publicado: { label: "Publicado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  concluido: { label: "Publicado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  erro: { label: "Erro", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
};

const TYPE_LABEL: Record<string, string> = {
  feed_instagram: "Feed Instagram",
  linkedin: "LinkedIn",
  reel_turma: "Reel da Turma",
  whatsapp_participante: "WhatsApp Participantes",
  whatsapp_grupos: "WhatsApp Grupos",
  depoimento: "Depoimentos",
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", s.cls)}>{s.label}</span>;
}

export function TurmaFactoryDialog({ open, onOpenChange, turmaId, turmaLabel, factoryStatus }: Props) {
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<FactoryRun | null>(null);
  const [assets, setAssets] = useState<FactoryAsset[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Load run + assets
  useEffect(() => {
    if (!open || !turmaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: runs } = await supabase
        .from("training_factory_runs" as any)
        .select("*")
        .eq("turma_id", turmaId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const r = (runs?.[0] ?? null) as FactoryRun | null;
      setRun(r);
      if (r) {
        const { data: a } = await supabase
          .from("training_factory_assets" as any)
          .select("*")
          .eq("run_id", r.id)
          .order("asset_type", { ascending: true })
          .order("created_at", { ascending: true });
        if (cancelled) return;
        setAssets((a as unknown as FactoryAsset[]) ?? []);
      } else {
        setAssets([]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, turmaId]);

  // Realtime subscription on assets
  useEffect(() => {
    if (!open || !run?.id) return;
    const channel = supabase
      .channel(`factory-assets-${run.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "training_factory_assets", filter: `run_id=eq.${run.id}` },
        (payload) => {
          const rec = payload.new as FactoryAsset;
          setAssets((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((x) => x.id !== (payload.old as any).id);
            const idx = prev.findIndex((x) => x.id === rec.id);
            if (idx === -1) return [...prev, rec];
            const next = [...prev];
            next[idx] = { ...next[idx], ...rec };
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, run?.id]);

  const grouped = useMemo(() => {
    const map = new Map<string, FactoryAsset[]>();
    for (const a of assets) {
      const key = a.asset_type;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [assets]);

  const effectiveStatus = (run?.status ?? factoryStatus ?? "") as string;
  const canPublish = effectiveStatus === "pronto" && !publishing;

  const saveEdit = async (asset: FactoryAsset) => {
    const value = edits[asset.id];
    if (value == null) return;
    setSavingId(asset.id);
    const field = asset.asset_type === "whatsapp_participante" || asset.asset_type === "whatsapp_grupos"
      ? "whatsapp_text"
      : "caption";
    const { error } = await supabase
      .from("training_factory_assets" as any)
      .update({ [field]: value })
      .eq("id", asset.id);
    setSavingId(null);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else {
      setAssets((prev) => prev.map((x) => (x.id === asset.id ? { ...x, [field]: value } : x)));
      toast({ title: "Salvo" });
    }
  };

  const publishAll = async () => {
    if (!run) return;
    setPublishing(true);
    try {
      const { error } = await supabase.functions.invoke("training-factory-publish", {
        body: { run_id: run.id },
      });
      if (error) throw error;
      toast({ title: "Publicação iniciada", description: "Os assets estão sendo publicados." });
    } catch (e: any) {
      toast({ title: "Falha ao publicar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle>Factory{turmaLabel ? ` — ${turmaLabel}` : ""}</DialogTitle>
              <DialogDescription>Pré-visualize, edite e publique os assets gerados para esta turma.</DialogDescription>
            </div>
            {effectiveStatus && <StatusPill status={effectiveStatus} />}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : !run ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhum run de fábrica encontrado para esta turma ainda.
            </div>
          ) : assets.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Sem assets gerados.</div>
          ) : (
            grouped.map(([type, items]) => (
              <section key={type} className="space-y-3">
                <div className="flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                  <TypeIcon type={type} />
                  <h4 className="text-sm font-semibold">{TYPE_LABEL[type] ?? type}</h4>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      editValue={edits[asset.id]}
                      onEditChange={(v) => setEdits((s) => ({ ...s, [asset.id]: v }))}
                      onSave={() => saveEdit(asset)}
                      saving={savingId === asset.id}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {run && (
          <div className="pt-4 border-t flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Run: <code className="font-mono">{run.id.slice(0, 8)}</code>
            </span>
            <Button
              size="lg"
              onClick={publishAll}
              disabled={!canPublish}
              className={cn(canPublish && "bg-emerald-600 hover:bg-emerald-700 text-white")}
            >
              {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {effectiveStatus === "concluido" ? "Publicado" : "Publicar Tudo"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === "reel_turma") return <Video className="w-4 h-4 text-muted-foreground" />;
  if (type.startsWith("whatsapp_grupos")) return <Users className="w-4 h-4 text-muted-foreground" />;
  if (type.startsWith("whatsapp")) return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
  return <ImageIcon className="w-4 h-4 text-muted-foreground" />;
}

function AssetCard({
  asset, editValue, onEditChange, onSave, saving,
}: {
  asset: FactoryAsset;
  editValue: string | undefined;
  onEditChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const isWhatsapp = asset.asset_type === "whatsapp_participante" || asset.asset_type === "whatsapp_grupos";
  const text = isWhatsapp ? (asset.whatsapp_text ?? "") : (asset.caption ?? "");
  const current = editValue ?? text;
  const dirty = editValue != null && editValue !== text;
  const isVideo = (asset.media_type ?? "").startsWith("video") || asset.asset_type === "reel_turma";

  return (
    <div className="border rounded-lg p-3 bg-card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {asset.participant_name && (
            <div className="text-sm font-medium truncate">{asset.participant_name}</div>
          )}
          {asset.participant_phone && (
            <div className="text-[11px] text-muted-foreground">{asset.participant_phone}</div>
          )}
        </div>
        <StatusPill status={asset.status} />
      </div>

      {asset.media_url && (
        <div className="rounded-md overflow-hidden bg-muted aspect-video flex items-center justify-center">
          {isVideo ? (
            <video src={asset.media_url} controls className="w-full h-full object-cover" />
          ) : (
            <img src={asset.media_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      )}

      {asset.transcription && (
        <div className="text-xs bg-muted/50 rounded p-2">
          <div className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Transcrição</div>
          <p className="whitespace-pre-wrap">{asset.transcription}</p>
        </div>
      )}

      <Textarea
        value={current}
        onChange={(e) => onEditChange(e.target.value)}
        rows={isWhatsapp ? 4 : 6}
        className="text-xs"
        placeholder={isWhatsapp ? "Mensagem WhatsApp..." : "Caption..."}
      />

      {asset.hashtags && asset.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {asset.hashtags.slice(0, 8).map((h, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">#{h.replace(/^#/, "")}</Badge>
          ))}
        </div>
      )}

      {(asset.publish_error || asset.wa_error) && (
        <p className="text-[11px] text-rose-600">{asset.publish_error || asset.wa_error}</p>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={onSave}>
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}
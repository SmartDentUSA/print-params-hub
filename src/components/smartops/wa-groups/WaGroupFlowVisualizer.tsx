import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Clock, Sparkles, Image as ImageIcon, Video, Link2,
  CheckCircle2, XCircle, Loader2, Timer,
  Hand, List, LayoutList,
} from "lucide-react";
import type { WaQueueRow, WaCampaignRow } from "./types";

interface Props { campaignId: string }

const typeIcon: Record<string, any> = {
  msg: MessageSquare, wait: Clock, ai: Sparkles,
  image: ImageIcon, video: Video, link: Link2,
  button: Hand, list: List, carousel: LayoutList,
};

const statusVariant: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sending: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  sent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  skipped: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

function countdown(target: string | null): string {
  if (!target) return "—";
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return "agora";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `em ${d}d ${h}h`;
  if (h > 0) return `em ${h}h ${m}m`;
  return `em ${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function WaGroupFlowVisualizer({ campaignId }: Props) {
  const [campaign, setCampaign] = useState<WaCampaignRow | null>(null);
  const [queue, setQueue] = useState<WaQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const fetchAll = useCallback(async () => {
    const sb = supabase as any;
    const [{ data: c, error: ec }, { data: q, error: eq }] = await Promise.all([
      sb.from("wa_campaigns").select("*").eq("id", campaignId).single(),
      sb.from("wa_message_queue").select("*").eq("campaign_id", campaignId).order("sequence_no", { ascending: true }),
    ]);
    if (ec || eq) { toast.error((ec ?? eq)?.message); setLoading(false); return; }
    setCampaign(c);
    setQueue(q ?? []);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const ch = (supabase as any)
      .channel(`wa-flow-${campaignId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "wa_message_queue", filter: `campaign_id=eq.${campaignId}` },
        () => fetchAll())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "wa_campaigns", filter: `id=eq.${campaignId}` },
        () => fetchAll())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [campaignId, fetchAll]);

  // Countdown tick (1s)
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(i);
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!campaign) return <p className="text-muted-foreground">Campanha não encontrada.</p>;

  // Filtrar apenas linhas correspondentes a nós que ainda existem no editor de fluxo atual
  const flowNodes: any[] = Array.isArray((campaign as any).flow_json) ? (campaign as any).flow_json : [];
  const visibleQueue = queue.filter((row) => {
    const node = flowNodes[row.node_index];
    if (!node) return false;
    // Defensive: se o tipo do nó mudou na mesma posição, esconde resíduo
    if (node.type && row.node_type && node.type !== row.node_type) return false;
    return true;
  });

  const total = visibleQueue.length;
  const sent = visibleQueue.filter(q => q.status === "sent").length;
  const failed = visibleQueue.filter(q => q.status === "failed").length;
  const pending = visibleQueue.filter(q => q.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              Status: <Badge variant="outline" className="ml-1">{campaign.status}</Badge>
              {campaign.started_at && <> · Iniciada em {new Date(campaign.started_at).toLocaleString("pt-BR")}</>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={fetchAll}
              className="text-xs px-2 py-1 rounded border hover:bg-muted transition"
              title="Atualizar agora"
            >
              ↻ Atualizar
            </button>
            <div className="text-center"><div className="font-semibold text-emerald-600">{sent}</div><div className="text-[10px] text-muted-foreground">Enviadas</div></div>
            <div className="text-center"><div className="font-semibold">{pending}</div><div className="text-[10px] text-muted-foreground">Pendentes</div></div>
            <div className="text-center"><div className="font-semibold text-red-600">{failed}</div><div className="text-[10px] text-muted-foreground">Falhas</div></div>
            <div className="text-center"><div className="font-semibold">{total}</div><div className="text-[10px] text-muted-foreground">Total</div></div>
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <div className="relative pl-6 space-y-3">
        <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
        {visibleQueue.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nenhuma mensagem na fila.</p>
        )}
        {visibleQueue.map((row) => {
          const Icon = typeIcon[row.node_type] ?? MessageSquare;
          const StatusIcon =
            row.status === "sent" ? CheckCircle2 :
            row.status === "failed" ? XCircle :
            row.status === "sending" ? Loader2 :
            Timer;
          return (
            <div key={row.id} className="relative">
              <div className="absolute -left-[19px] top-3 w-3 h-3 rounded-full bg-background border-2 border-primary" />
              <Card className="p-3">
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">#{row.sequence_no}</Badge>
                      <span className="text-sm font-medium capitalize">{row.node_type}</span>
                      <Badge className={`text-[10px] ${statusVariant[row.status]}`}>
                        <StatusIcon className={`w-3 h-3 mr-1 ${row.status === "sending" ? "animate-spin" : ""}`} />
                        {row.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Agendado: {new Date(row.scheduled_at).toLocaleString("pt-BR")}
                      {row.status === "pending" && <> · <span className="text-primary">{countdown(row.scheduled_at)}</span></>}
                      {row.sent_at && <> · Enviado: {new Date(row.sent_at).toLocaleString("pt-BR")}</>}
                    </div>
                    {row.error_message && (
                      <p className="text-[11px] text-red-600 mt-1">⚠ {row.error_message}</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WaGroupFlowVisualizer;
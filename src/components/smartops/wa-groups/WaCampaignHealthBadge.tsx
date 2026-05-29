import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertTriangle, RotateCcw, Activity } from "lucide-react";
import { toast } from "sonner";

type Health = {
  scheduled: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  stuck: number;
  last_sent_at: string | null;
};

export function WaCampaignHealthBadge({ campaignId, compact = false }: { campaignId: string; compact?: boolean }) {
  const [h, setH] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("v_wa_campaign_delivery_health")
      .select("scheduled,sent,delivered,read,failed,stuck,last_sent_at")
      .eq("campaign_id", campaignId)
      .maybeSingle();
    setH(data ?? { scheduled: 0, sent: 0, delivered: 0, read: 0, failed: 0, stuck: 0, last_sent_at: null });
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel(`wa-health-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_message_queue", filter: `campaign_id=eq.${campaignId}` }, () => load())
      .subscribe();
    const t = setInterval(load, 30_000);
    return () => { clearInterval(t); (supabase as any).removeChannel(ch); };
  }, [campaignId, load]);

  const reprocess = async () => {
    setReprocessing(true);
    try {
      const { data, error } = await (supabase as any).rpc("fn_wa_reprocess_undelivered", { p_campaign_id: campaignId });
      if (error) throw error;
      toast.success(`${data ?? 0} mensagem(ns) reenfileirada(s) para reenvio`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reprocessar");
    } finally {
      setReprocessing(false);
    }
  };

  if (loading || !h) return null;
  if (h.scheduled === 0 && h.sent === 0 && h.failed === 0) {
    return compact ? null : (
      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        <Activity className="w-3 h-3" /> sem envios ainda
      </span>
    );
  }

  const hasFailed = h.failed > 0 || h.stuck > 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />{h.delivered}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Entregues / lidas</TooltipContent>
      </Tooltip>
      {h.stuck > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400">
              <Clock className="w-3 h-3" />{h.stuck}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Enviadas mas sem confirmação há &gt;10min</TooltipContent>
        </Tooltip>
      )}
      {h.failed > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 border-red-500/40 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3 h-3" />{h.failed}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Falhas / não entregues</TooltipContent>
        </Tooltip>
      )}
      {h.scheduled > 0 && (
        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />{h.scheduled} agend.
        </Badge>
      )}
      {hasFailed && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          disabled={reprocessing}
          onClick={reprocess}
        >
          <RotateCcw className={`w-3 h-3 mr-1 ${reprocessing ? "animate-spin" : ""}`} />
          Reprocessar
        </Button>
      )}
    </div>
  );
}
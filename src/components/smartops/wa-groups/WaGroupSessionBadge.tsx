import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertOctagon, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";

interface Props {
  groupJid: string;
  sessionHealth?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  autoFallback?: boolean | null;
  onReactivated?: () => void;
}

export function WaGroupSessionBadge({
  groupJid,
  sessionHealth,
  lastError,
  lastErrorAt,
  autoFallback,
  onReactivated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const broken = sessionHealth === "session_broken";

  const reactivate = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("fn_wa_reactivate_group", { p_group_jid: groupJid });
      if (error) throw error;
      const released = (data as any)?.released ?? 0;
      toast.success(`Grupo reativado — ${released} mensagem(ns) re-enfileirada(s)`);
      onReactivated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reativar grupo");
    } finally {
      setBusy(false);
    }
  };

  if (!broken && !autoFallback) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> sessão ok
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Sessão WhatsApp saudável</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {broken && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 border-red-500/40 text-red-700 dark:text-red-400">
              <AlertOctagon className="w-3 h-3" /> sessão quebrada
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs space-y-1">
              <div className="font-medium">Envios bloqueados após 2 falhas consecutivas.</div>
              {lastError && <div className="opacity-80 break-words">{lastError.slice(0, 240)}</div>}
              {lastErrorAt && <div className="opacity-60">{new Date(lastErrorAt).toLocaleString("pt-BR")}</div>}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {autoFallback && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400">
              <Wrench className="w-3 h-3" /> auto-fallback
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Usando chave Evolution global porque a per-instance falhou em grupos. Revalide a apikey da instância.
          </TooltipContent>
        </Tooltip>
      )}
      {broken && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          disabled={busy}
          onClick={reactivate}
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${busy ? "animate-spin" : ""}`} />
          Reativar
        </Button>
      )}
    </div>
  );
}
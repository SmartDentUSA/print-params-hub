import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Unlock } from "lucide-react";

/** Desbloqueio de acesso do KOL e requisito de celular válido e único para o primeiro contrato. */
export async function checkKolContractReady(leadId: string): Promise<{ ok: boolean; motivo?: string }> {
  const { data, error } = await (supabase as any).rpc("fn_kol_contract_ready", { _lead_id: leadId });
  if (error) return { ok: false, motivo: error.message };
  return data as { ok: boolean; motivo?: string };
}

export default function KolAccessActions({ leadId }: { leadId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ ok: boolean; motivo?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    checkKolContractReady(leadId).then((r) => alive && setReady(r));
    return () => { alive = false; };
  }, [leadId]);

  const unblock = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("fn_kol_unblock", { _lead_id: leadId });
    setBusy(false);
    if (error) return toast({ title: "Não foi possível desbloquear", description: error.message, variant: "destructive" });
    toast({ title: "Acesso desbloqueado", description: `${data ?? 0} tentativa(s) removida(s).` });
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={unblock} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />} Desbloquear acesso
      </Button>
      {ready && (
        <Badge variant={ready.ok ? "secondary" : "destructive"} title={ready.motivo}>
          {ready.ok ? "Celular ok para contrato" : `Contrato bloqueado: ${ready.motivo}`}
        </Badge>
      )}
    </>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, MessageSquareText, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const TYPE: Record<string, string> = { lead: "Lead do evento", kol: "KOL do evento", oportunidade: "Outra oportunidade do evento", venda_direta: "Lead do evento — venda direta", distribuicao: "Distribuidor do evento", oportunidade_distribuicao: "Distribuidor do evento — oportunidade de abrir distribuição" };
const typeLabel = (t: string, st?: string | null) =>
  t === "lead" && st === "venda_direta" ? TYPE.venda_direta : t === "distribuicao" && st === "oportunidade" ? TYPE.oportunidade_distribuicao : TYPE[t];
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  collecting: { label: "Recebendo", variant: "outline" },
  processing: { label: "Processando", variant: "secondary" },
  done: { label: "Criado no CRM", variant: "default" },
  error: { label: "Erro", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

/** Capturas enviadas pela equipe ao WhatsApp Oficial (cartões, áudios, fotos) para este evento. */
export function EventFieldCapturesButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["field-captures", eventId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("field_capture_sessions")
        .select("id, capture_type, subtype, status, opportunity_name, extracted, summary, drive_folder_url, error, created_at, team_member_id, field_capture_items(count)")
        .eq("event_id", eventId).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r: any) => r.team_member_id))];
      const { data: tms } = ids.length ? await supabase.from("team_members").select("id, nome_completo").in("id", ids as string[]) : { data: [] as any[] };
      const names = new Map((tms ?? []).map((t: any) => [t.id, t.nome_completo]));
      return (data ?? []).map((r: any) => ({ ...r, sender: names.get(r.team_member_id) ?? "—", items: r.field_capture_items?.[0]?.count ?? 0 }));
    },
  });

  const reprocess = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.functions.invoke("wa-field-capture", { body: { action: "reprocess", session_id: id } });
    setBusy(null);
    if (error || (data as any)?.ok === false) toast.error((data as any)?.error || "Não foi possível reprocessar");
    else toast.success("Captura enviada ao CRM");
    q.refetch();
  };

  return (
    <>
      <Button size="sm" variant="ghost" title="Capturas WhatsApp (cartões, áudios, fotos)" onClick={() => setOpen(true)}>
        <MessageSquareText className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Capturas WhatsApp</DialogTitle>
            <DialogDescription>
              Capturas recebidas pelo WhatsApp Oficial neste evento.
            </DialogDescription>
          </DialogHeader>
          {q.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : !q.data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma captura neste evento.</p>
          ) : (
            <div className="space-y-2">
              {q.data.map((r: any) => {
                const st = STATUS[r.status] ?? { label: r.status, variant: "outline" as const };
                const x = r.extracted ?? {};
                return (
                  <div key={r.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{r.opportunity_name || x.nome || "Sem nome ainda"}</strong>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {r.capture_type && <Badge variant="outline">{typeLabel(r.capture_type, (r as any).subtype)}</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enviado por {r.sender} · {r.items} {r.items === 1 ? "item" : "itens"}
                      {x.telefone ? ` · ${x.telefone}` : ""}{x.email ? ` · ${x.email}` : ""}{x.cidade ? ` · ${x.cidade}${x.estado ? `/${x.estado}` : ""}` : ""}
                    </p>
                    {r.summary && <p className="mt-1">{r.summary}</p>}
                    {r.error && <p className="mt-1 text-destructive">{r.error}</p>}
                    <div className="mt-2 flex gap-2">
                      {r.drive_folder_url && (
                        <Button asChild size="sm" variant="outline"><a href={r.drive_folder_url} target="_blank" rel="noopener"><ExternalLink className="mr-1 h-3 w-3" /> Drive</a></Button>
                      )}
                      {r.status === "error" && (
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => reprocess(r.id)}>
                          {busy === r.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />} Reprocessar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

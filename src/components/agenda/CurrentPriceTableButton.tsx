import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, Loader2, Receipt, Ticket, Timer } from "lucide-react";
import { call } from "./CrmInsertionButton";
import { countdownLabel } from "@/lib/countdownParts";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; sku: string | null; quantity: number; market_unit_price: number; promotional_unit_price: number };
type Section = { id: string; title: string; description: string | null; items: Item[] };
type Coupon = { code: string; discount_type: string; discount_value: number; kind: string | null; free_shipping: boolean | null };
type CurrentTable = {
  id: string; name: string; pdf_title: string | null; currency: string; notes: string | null;
  valid_from: string; valid_until: string; pdf_url: string | null;
  starts_at: string; ends_at: string; sections: Section[]; my_coupons: Coupon[];
};
type Payload = { server_now: string; table: CurrentTable | null; next: { name: string; starts_at: string } | null };

const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Botão "Tabela vigente" da Agenda (equipe) com cronômetro até o fim da validade. */
export function CurrentPriceTableButton() {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const q = useQuery({
    queryKey: ["agenda-current-price-table"],
    queryFn: () => call<Payload>("price_table"),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Relógio alinhado ao servidor para a troca acontecer na meia-noite certa.
  const skew = q.data ? Date.parse(q.data.server_now) - q.dataUpdatedAt : 0;
  const serverNow = now + skew;
  const table = q.data?.table ?? null;
  const next = q.data?.next ?? null;
  const left = table ? Date.parse(table.ends_at) - serverNow : 0;
  const nextIn = next ? Date.parse(next.starts_at) - serverNow : 0;

  // Acabou a validade ou chegou a hora da próxima → busca de novo.
  const expired = (table && left <= 0) || (!table && next && nextIn <= 0);
  useEffect(() => {
    if (expired && !q.isFetching) q.refetch();
  }, [expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const urgent = table && left < 24 * 3600_000;
  const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: table?.currency || "BRL" });
  const fileName = table ? `${table.pdf_title || table.name}.pdf` : "tabela.pdf";

  return (
    <>
      <div className="flex w-full flex-col items-center gap-1.5">
        <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}>
          <Receipt className="h-4 w-4" /> Tabela vigente
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
          {q.isLoading ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Carregando tabela…</span>
          ) : q.isError ? (
            <span>Não foi possível carregar a tabela vigente.</span>
          ) : table ? (
            <>
              <span className="font-medium text-foreground">{table.name}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono tabular-nums", urgent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                <Timer className="h-3 w-3" /> termina em {countdownLabel(left)}
              </span>
            </>
          ) : next ? (
            <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> {next.name} começa em <span className="font-mono tabular-nums">{countdownLabel(nextIn)}</span></span>
          ) : (
            <span>Nenhuma tabela vigente para o comercial.</span>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Tabela vigente</DialogTitle>
            <DialogDescription>
              {table ? `${table.name} · válida de ${day(table.valid_from)} a ${day(table.valid_until)} (até 23:59)` : "Nenhuma tabela marcada como ativa para o comercial vale hoje."}
            </DialogDescription>
          </DialogHeader>

          {!table ? (
            <div className="space-y-2 py-6 text-center text-sm text-muted-foreground">
              <p>Nenhuma tabela vigente no momento.</p>
              {next && <p>Próxima: <span className="font-medium text-foreground">{next.name}</span> a partir de {when(next.starts_at)}.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn("flex items-center justify-between gap-3 rounded-md border p-3", urgent ? "border-destructive/40 bg-destructive/5" : "bg-muted/40")}>
                <div>
                  <p className="text-xs text-muted-foreground">Tempo restante</p>
                  <p className={cn("font-mono text-xl font-semibold tabular-nums", urgent ? "text-destructive" : "text-foreground")}>{countdownLabel(left)}</p>
                </div>
                {next && <p className="max-w-[50%] text-right text-xs text-muted-foreground">Depois: <span className="font-medium text-foreground">{next.name}</span><br />a partir de {when(next.starts_at)}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {table.pdf_url ? (
                  <>
                    <Button asChild size="sm"><a href={table.pdf_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir PDF</a></Button>
                    <Button asChild size="sm" variant="outline"><a href={table.pdf_url} download={fileName} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Baixar PDF</a></Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">O PDF desta tabela ainda não foi publicado. Ele é gerado quando a tabela é salva no editor.</p>
                )}
              </div>

              {table.my_coupons.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium"><Ticket className="h-4 w-4 text-primary" /> Seus cupons nesta tabela</p>
                  <div className="flex flex-wrap gap-2">
                    {table.my_coupons.map((c) => (
                      <Badge key={c.code} variant="secondary" className="font-mono">
                        {c.code} · {c.free_shipping || c.kind === "freight" ? "frete grátis" : c.discount_type === "percent" ? `${c.discount_value}%` : money(c.discount_value)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {table.notes && <p className="whitespace-pre-line rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{table.notes}</p>}

              {table.sections.map((s) => (
                <div key={s.id} className="space-y-2">
                  <p className="text-sm font-semibold">{s.title}</p>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  <div className="divide-y rounded-md border">
                    {s.items.map((i) => (
                      <div key={i.id} className="flex items-start justify-between gap-3 p-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate">{Number(i.quantity) !== 1 ? `${i.quantity}× ` : ""}{i.name}</p>
                          {i.sku && <p className="text-xs text-muted-foreground">{i.sku}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          {Number(i.market_unit_price) > Number(i.promotional_unit_price) && <p className="text-xs text-muted-foreground line-through">{money(i.market_unit_price)}</p>}
                          <p className="font-semibold">{money(i.promotional_unit_price)}</p>
                        </div>
                      </div>
                    ))}
                    {!s.items.length && <p className="p-2.5 text-xs text-muted-foreground">Sem itens.</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

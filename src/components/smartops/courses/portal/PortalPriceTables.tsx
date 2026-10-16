import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Receipt } from "lucide-react";

interface PriceTable {
  id: string;
  name: string;
  pdf_title: string | null;
  valid_until: string | null;
  kol_pdf_url: string;
  kol_pdf_updated_at: string | null;
}

const fmt = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR") : null);

/** Tabelas de preços vinculadas aos KOLs: leitura com rolagem (sem edição) e download do PDF. */
export default function PortalPriceTables({
  call,
}: {
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
}) {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    call("price_tables")
      .then((res) => {
        if (!alive) return;
        const list: PriceTable[] = res?.tables ?? [];
        setTables(list);
        setActiveId(list[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [call]);

  const active = tables.find((t) => t.id === activeId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg"><Receipt className="h-5 w-5 text-primary" />Tabela de preços</CardTitle>
        {active && (
          <Button asChild size="sm">
            <a href={active.kol_pdf_url} download={`${active.pdf_title || active.name}.pdf`} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />Baixar PDF
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tables.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma tabela de preços disponível no momento.</p>
        ) : (
          <>
            {tables.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {tables.map((t) => (
                  <Button key={t.id} size="sm" variant={t.id === activeId ? "default" : "outline"} onClick={() => setActiveId(t.id)}>
                    {t.pdf_title || t.name}
                  </Button>
                ))}
              </div>
            )}
            {active && (
              <>
                <p className="text-xs text-muted-foreground">
                  {active.valid_until ? `Válida até ${fmt(active.valid_until)}` : "Sem validade definida"}
                  {active.kol_pdf_updated_at ? ` · Atualizada em ${fmt(active.kol_pdf_updated_at)}` : ""}
                </p>
                <div className="h-[75vh] overflow-hidden rounded-lg border bg-muted">
                  <iframe
                    key={active.id}
                    title={active.name}
                    src={`${active.kol_pdf_url}#toolbar=0&navpanes=0&view=FitH`}
                    className="h-full w-full"
                  />
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

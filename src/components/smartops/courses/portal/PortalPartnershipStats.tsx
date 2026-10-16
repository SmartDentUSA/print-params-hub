import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Handshake } from "lucide-react";

interface PartnershipData {
  indicacoes: number;
  vendas: number;
  receita: number;
  conversao: number;
  formularios: string[];
  cupons: string[];
  comissao_vigente: { produto: string; percentual: number | null; canal: string }[];
  ultimas_vendas: { origem: string; nome: string | null; valor: number; data: string | null }[];
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const CANAL_LABEL: Record<string, string> = { indicacao: "Indicação", cupom: "Cupom", formulario: "Formulário" };

/** Transparência da parceria: indicações, vendas atribuídas, conversão e comissão vigente. */
export default function PortalPartnershipStats({
  call,
}: {
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
}) {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<PartnershipData | null>(null);

  useEffect(() => {
    let alive = true;
    call("partnership_stats")
      .then((res) => { if (alive) setD(res); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
  }, [call]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Handshake className="w-4 h-4 text-primary" /> Sua parceria em números
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : !d ? (
          <p className="text-xs text-muted-foreground">Não foi possível carregar os dados da parceria.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                ["Indicações", d.indicacoes],
                ["Vendas", d.vendas],
                ["Conversão", `${String(d.conversao).replace(".", ",")}%`],
                ["Receita gerada", BRL(d.receita)],
              ].map(([label, v]) => (
                <div key={String(label)} className="rounded-md border p-3 text-center">
                  <div className="text-lg font-semibold">{v}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {(d.formularios.length > 0 || d.cupons.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {d.formularios.map((f) => <Badge key={f} variant="secondary">Formulário: {f}</Badge>)}
                {d.cupons.map((c) => <Badge key={c} variant="outline">Cupom: {c}</Badge>)}
              </div>
            )}

            {d.comissao_vigente.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Comissão vigente</p>
                <ul className="divide-y rounded-md border">
                  {d.comissao_vigente.map((r, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span>{r.produto}</span>
                      <span className="text-muted-foreground">
                        {r.percentual != null ? `${String(r.percentual).replace(".", ",")}%` : "—"} · {CANAL_LABEL[r.canal] ?? r.canal}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.ultimas_vendas.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Últimas vendas atribuídas</p>
                <ul className="divide-y rounded-md border">
                  {d.ultimas_vendas.map((v, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span>{v.nome ?? "—"} <span className="text-muted-foreground">({v.origem === "cupom" ? "cupom" : "indicação"})</span></span>
                      <span className="text-muted-foreground">{BRL(v.valor)} · {fmtDate(v.data)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.indicacoes === 0 && d.cupons.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Quando seus formulários de indicação e cupons estiverem ativos, os números da parceria aparecem aqui automaticamente.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

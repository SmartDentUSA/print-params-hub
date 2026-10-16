import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Percent } from "lucide-react";

interface CommissionRule {
  produto: string;
  percentual: number | null;
  canal: string;
}

const CANAL_LABEL: Record<string, string> = { indicacao: "Indicação", cupom: "Cupom", formulario: "Formulário" };

/** Comissão vigente do profissional: regras por produto e canal. */
export default function PortalCommissionStats({
  call,
}: {
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
}) {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<CommissionRule[]>([]);

  useEffect(() => {
    let alive = true;
    call("partnership_stats")
      .then((res) => { if (alive) setRules(res?.comissao_vigente ?? []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
  }, [call]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary" /> Comissão vigente
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma regra de comissão configurada no momento. Quando a equipe Smart Dent definir seus percentuais, eles aparecem aqui.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rules.map((r, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <span>{r.produto}</span>
                <span className="text-muted-foreground">
                  {r.percentual != null ? `${String(r.percentual).replace(".", ",")}%` : "—"} · {CANAL_LABEL[r.canal] ?? r.canal}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

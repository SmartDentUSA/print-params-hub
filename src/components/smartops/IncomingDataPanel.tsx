import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Inbox } from "lucide-react";

interface Source {
  key: string;
  label: string;
  table: string;
  column?: string;
  description: string;
}

const SOURCES: Source[] = [
  { key: "meta_leads", label: "Meta Lead Ads", table: "meta_lead_ingestion_log", description: "Leads via formulários Meta" },
  { key: "form_subs", label: "Form Submissions", table: "lead_form_submissions", description: "Submissões de formulários internos" },
  { key: "piperun_events", label: "PipeRun Webhooks", table: "piperun_webhook_events", description: "Eventos deal/person do PipeRun" },
  { key: "loja_orders", label: "E-commerce (Loja Integrada)", table: "loja_integrada_orders", description: "Pedidos da loja" },
  { key: "astron_access", label: "Astron Academy", table: "astron_member_access", description: "Acessos Astron" },
  { key: "wa_inbox", label: "WhatsApp recebidas", table: "whatsapp_inbox", description: "Mensagens WA recebidas" },
  { key: "tldv_meetings", label: "tldv Meetings", table: "tldv_meetings", description: "Reuniões sincronizadas" },
  { key: "google_reviews", label: "Google Reviews", table: "google_reviews", description: "Avaliações capturadas" },
  { key: "ig_mentions", label: "Instagram mentions (Zernio)", table: "social_ig_mentions", description: "Menções IG" },
  { key: "meta_capi", label: "Meta CAPI events", table: "meta_capi_event_log", description: "Eventos enviados ao Meta" },
  { key: "wa_send", label: "WhatsApp enviadas", table: "wa_send_log", description: "Mensagens WA enviadas" },
  { key: "omie_nf", label: "Omie Notas Fiscais", table: "omie_notas_fiscais", description: "NFs sincronizadas" },
];

interface Row extends Source {
  count_24h: number | null;
  avg_7d: number | null;
  last_at: string | null;
  loading: boolean;
  error?: string;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

async function fetchSource(src: Source): Promise<Pick<Row, "count_24h" | "avg_7d" | "last_at" | "error">> {
  try {
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
    const col = src.column ?? "created_at";

    const [r24, r7d, rLast] = await Promise.all([
      supabase.from(src.table as never).select("*", { count: "exact", head: true }).gte(col, since24h),
      supabase.from(src.table as never).select("*", { count: "exact", head: true }).gte(col, since7d),
      supabase.from(src.table as never).select(col).order(col, { ascending: false }).limit(1),
    ]);

    if (r24.error) throw r24.error;
    const c24 = r24.count ?? 0;
    const c7 = r7d.count ?? 0;
    const avg = c7 / 7;
    const lastRow = (rLast.data ?? [])[0] as Record<string, string> | undefined;
    return {
      count_24h: c24,
      avg_7d: Math.round(avg),
      last_at: lastRow?.[col] ?? null,
    };
  } catch (e) {
    return {
      count_24h: null,
      avg_7d: null,
      last_at: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function IncomingDataPanel() {
  const [rows, setRows] = useState<Row[]>(
    SOURCES.map((s) => ({ ...s, count_24h: null, avg_7d: null, last_at: null, loading: true })),
  );
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const results = await Promise.all(SOURCES.map(fetchSource));
    setRows(SOURCES.map((s, i) => ({ ...s, ...results[i], loading: false })));
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const total24h = rows.reduce((sum, r) => sum + (r.count_24h ?? 0), 0);
  const sourcesUp = rows.filter((r) => (r.count_24h ?? 0) > 0).length;
  const sourcesQuiet = rows.filter((r) => r.count_24h === 0).length;
  const sourcesError = rows.filter((r) => r.error).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5" />
          <h3 className="text-base font-semibold">Entrada de Dados — últimas 24h</h3>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{total24h.toLocaleString("pt-BR")}</div><div className="text-xs text-muted-foreground">Registros 24h</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">{sourcesUp}</div><div className="text-xs text-muted-foreground">Fontes ativas</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-yellow-600">{sourcesQuiet}</div><div className="text-xs text-muted-foreground">Sem dados 24h</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-red-600">{sourcesError}</div><div className="text-xs text-muted-foreground">Com erro de leitura</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => {
          const c = r.count_24h ?? 0;
          const avg = r.avg_7d ?? 0;
          let trendIcon = <Minus className="w-3 h-3" />;
          let trendColor = "text-muted-foreground";
          let trendLabel = "estável";
          if (avg > 0) {
            const delta = (c - avg) / avg;
            if (delta <= -0.5) { trendIcon = <TrendingDown className="w-3 h-3" />; trendColor = "text-red-600"; trendLabel = `${Math.round(delta * 100)}% vs média`; }
            else if (delta >= 0.5) { trendIcon = <TrendingUp className="w-3 h-3" />; trendColor = "text-green-600"; trendLabel = `+${Math.round(delta * 100)}% vs média`; }
            else { trendLabel = `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}% vs média`; }
          }
          return (
            <Card key={r.key} className={r.error ? "border-red-200" : c === 0 ? "border-yellow-200" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="truncate" title={r.label}>{r.label}</span>
                  {r.loading ? (
                    <Badge variant="outline" className="text-[10px]">…</Badge>
                  ) : r.error ? (
                    <Badge variant="destructive" className="text-[10px]">erro</Badge>
                  ) : c === 0 ? (
                    <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">sem dados</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">ativa</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{c.toLocaleString("pt-BR")}</div>
                <div className={`text-xs flex items-center gap-1 mt-1 ${trendColor}`}>
                  {trendIcon} {trendLabel} (média 7d: {avg.toLocaleString("pt-BR")})
                </div>
                <div className="text-xs text-muted-foreground mt-1">Último: {relTime(r.last_at)}</div>
                <div className="text-[10px] text-muted-foreground mt-2 font-mono">{r.table}</div>
                {r.error && <div className="text-[10px] text-red-600 mt-1 truncate" title={r.error}>{r.error}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
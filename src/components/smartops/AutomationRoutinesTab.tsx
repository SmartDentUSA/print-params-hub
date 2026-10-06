import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Stethoscope } from "lucide-react";

interface Routine {
  jobid: number; jobname: string; schedule: string; active: boolean; command: string;
  runs_24h: number; failures_24h: number; last_status: string | null; last_run: string | null; last_error: string | null;
}

// Regras por palavra-chave: aba do sistema, o que faz, sistemas externos e dados.
const RULES: { re: RegExp; aba: string; faz: string; apis: string; dados: string }[] = [
  { re: /painel|comercial/i, aba: "Painel Comercial", faz: "Recalcula KPIs, funil, vendedores e produtos do painel de TV", apis: "Banco interno (dados do PipeRun)", dados: "Receita, funil, mix de produtos" },
  { re: /piperun|crm|deal|funnel/i, aba: "Público / Lista · CRM", faz: "Sincroniza negócios, pessoas e etapas com o CRM", apis: "PipeRun API", dados: "Negócios, propostas, donos, etapas" },
  { re: /meta|lead.?ads|facebook/i, aba: "Formulários · Campanhas", faz: "Busca leads de formulários do Meta Ads", apis: "Meta Graph API", dados: "Leads de formulários e campanhas" },
  { re: /zernio|social|instagram|ig[-_]/i, aba: "Social Publisher · Campanhas", faz: "Publicações, inbox, anúncios e métricas sociais", apis: "Zernio, Instagram/Meta", dados: "Posts, comentários, DMs, métricas" },
  { re: /wa[-_]|whatsapp|evolution|waleads/i, aba: "WhatsApp", faz: "Envios, filas e captura de conversas de WhatsApp", apis: "Evolution API / WhatsApp", dados: "Mensagens, status, contatos" },
  { re: /omie/i, aba: "Intelligence", faz: "Importa notas e faturamento do ERP", apis: "Omie API", dados: "Notas fiscais, faturamento, clientes" },
  { re: /loja|ecommerce|li[-_]order|integrada/i, aba: "Intelligence · Cupons", faz: "Sincroniza pedidos e cupons do e-commerce", apis: "Loja Integrada API", dados: "Pedidos, cupons, clientes" },
  { re: /sellflux/i, aba: "Campanhas", faz: "Sincroniza contatos e tags da automação de marketing", apis: "SellFlux", dados: "Tags, campos, eventos" },
  { re: /email|gmail|sequence/i, aba: "Campanhas", faz: "Disparo agendado de e-mails e sequências", apis: "Gmail / e-mail", dados: "Envios e aberturas" },
  { re: /sms/i, aba: "Campanhas", faz: "Disparos de SMS", apis: "DisparoPro", dados: "Envios de SMS" },
  { re: /push/i, aba: "Campanhas", faz: "Envio de notificações push", apis: "Web Push", dados: "Notificações" },
  { re: /nps|cs[-_]/i, aba: "Automações · CS", faz: "Réguas de pós-venda e NPS", apis: "WhatsApp / SMS", dados: "Respostas NPS, contatos CS" },
  { re: /stripe|rms/i, aba: "Pagamentos RMS", faz: "Conciliação de pagamentos e assinaturas", apis: "Stripe", dados: "Pagamentos, assinaturas" },
  { re: /copilot|brain/i, aba: "Copilot", faz: "Atualiza o Cérebro do Copilot", apis: "Banco interno", dados: "Snapshots de KPIs" },
  { re: /sitemap|seo|gsc|index|llms/i, aba: "Conteúdo / SEO", faz: "Sitemaps, indexação e SEO", apis: "Google Search Console", dados: "URLs indexadas" },
  { re: /panda|video/i, aba: "Conteúdo", faz: "Sincroniza vídeos", apis: "PandaVideo", dados: "Vídeos e métricas" },
  { re: /health|watchdog|monitor/i, aba: "Saúde do Sistema", faz: "Monitora saúde e erros do sistema", apis: "IA (diagnóstico) / interno", dados: "Logs de saúde" },
  { re: /enrich|cognitive|lia|opportun/i, aba: "Intelligence", faz: "Enriquecimento e análise de leads por IA", apis: "Lovable AI / DeepSeek", dados: "Scores e próximas ações" },
  { re: /distribu/i, aba: "Distribuição", faz: "Atualiza distribuidores e links", apis: "Interno", dados: "Distribuidores" },
  { re: /react|stagn/i, aba: "Reativação & Fluxos", faz: "Reativação de leads parados", apis: "WhatsApp / CRM", dados: "Leads reativados" },
];

function describe(r: Routine) {
  const key = `${r.jobname} ${r.command}`;
  const rule = RULES.find((x) => x.re.test(key));
  const fn = r.command.match(/functions\/v1\/([a-z0-9-_]+)/i)?.[1];
  return {
    aba: rule?.aba ?? "Sistema (interno)",
    faz: rule?.faz ?? (fn ? `Executa a função ${fn}` : "Rotina de manutenção do banco"),
    apis: rule?.apis ?? (fn ? "Interno" : "Banco de dados"),
    dados: rule?.dados ?? "—",
  };
}

// Converte expressão cron em intervalo (min) e execuções/dia aproximadas.
function cadence(s: string): { min: number | null; perDay: number | null } {
  const p = s.trim().split(/\s+/);
  if (p.length < 5) { const m = s.match(/(\d+)\s*seconds?/i); return m ? { min: +m[1] / 60, perDay: Math.round(86400 / +m[1]) } : { min: null, perDay: null }; }
  const [mi, h, dom, , dow] = p;
  const count = (f: string, max: number) => {
    if (f === "*") return max;
    if (f.startsWith("*/")) return Math.ceil(max / +f.slice(2));
    return f.split(",").reduce((a, x) => a + (x.includes("-") ? +x.split("-")[1] - +x.split("-")[0] + 1 : 1), 0);
  };
  const perHour = count(mi, 60), hours = count(h, 24);
  let perDay = perHour * hours;
  if (dom !== "*") perDay = perDay / 30; else if (dow !== "*") perDay = (perDay * count(dow, 7)) / 7;
  return { min: perDay ? Math.round((1440 / perDay) * 10) / 10 : null, perDay: Math.round(perDay * 100) / 100 };
}

function health(r: Routine): "ATIVO" | "ATENÇÃO" | "FALHA" | "DESATIVADO" {
  if (!r.active) return "DESATIVADO";
  if (r.last_status === "failed" && r.failures_24h >= Math.max(1, r.runs_24h / 2)) return "FALHA";
  if (r.failures_24h > 0 || r.last_status === "failed") return "ATENÇÃO";
  const { perDay } = cadence(r.schedule);
  if (perDay && perDay >= 1 && r.runs_24h === 0) return "ATENÇÃO";
  return "ATIVO";
}

const HEALTH_STYLE: Record<string, string> = {
  ATIVO: "bg-primary/10 text-primary border-primary/30",
  "ATENÇÃO": "bg-accent text-accent-foreground border-border",
  FALHA: "bg-destructive/10 text-destructive border-destructive/30",
  DESATIVADO: "bg-muted text-muted-foreground",
};

export function AutomationRoutinesTab() {
  const [rows, setRows] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [, setSearchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("admin_list_cron_routines");
    if (error) toast.error(`Erro ao carregar rotinas: ${error.message}`);
    setRows((data as Routine[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (r: Routine, v: boolean) => {
    const { error } = await (supabase.rpc as any)("admin_set_cron_active", { p_jobname: r.jobname, p_active: v });
    if (error) return toast.error(error.message);
    toast.success(v ? "Rotina ativada" : "Rotina desativada");
    load();
  };

  const diagnose = (r: Routine) => {
    const d = describe(r);
    sessionStorage.setItem("copilot-prefill",
      `Diagnostique a rotina automática "${r.jobname}" (${d.faz}). Use diagnose_routine para ver execuções e erros, ` +
      `identifique a causa, corrija o que for possível e deixe a rotina ativa com reactivate_routine. Me diga o resultado.`);
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set("tab", "copilot"); return n; });
  };

  const list = useMemo(() => rows.filter((r) => !q || `${r.jobname} ${describe(r).aba}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const totals = useMemo(() => {
    const t = { ATIVO: 0, "ATENÇÃO": 0, FALHA: 0, DESATIVADO: 0 } as Record<string, number>;
    rows.forEach((r) => t[health(r)]++);
    return t;
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Rotinas automáticas ({rows.length})</CardTitle>
        <div className="flex gap-2 items-center flex-wrap">
          {Object.entries(totals).map(([k, v]) => <Badge key={k} variant="outline" className={HEALTH_STYLE[k]}>{k}: {v}</Badge>)}
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48 h-8" />
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Atualizar</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Aba do sistema</TableHead><TableHead>O que faz</TableHead>
              <TableHead>APIs / softwares externos</TableHead><TableHead>Ativo</TableHead><TableHead>Recorrência (min)</TableHead>
              <TableHead>Execuções/dia</TableHead><TableHead>Últimas 24h</TableHead><TableHead>Dados capturados</TableHead>
              <TableHead>Fluxo end-to-end</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.map((r) => {
                const d = describe(r); const c = cadence(r.schedule); const h = health(r);
                return (
                  <TableRow key={r.jobid}>
                    <TableCell className="font-mono text-xs">{r.jobname}<div className="text-muted-foreground">{r.schedule}</div></TableCell>
                    <TableCell className="text-xs">{d.aba}</TableCell>
                    <TableCell className="text-xs max-w-56">{d.faz}</TableCell>
                    <TableCell className="text-xs">{d.apis}</TableCell>
                    <TableCell><Switch checked={r.active} onCheckedChange={(v) => toggle(r, v)} /></TableCell>
                    <TableCell className="text-xs">{c.min ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.perDay ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.runs_24h} exec · {r.failures_24h} falhas</TableCell>
                    <TableCell className="text-xs">{d.dados}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={HEALTH_STYLE[h]}>{h}</Badge>
                      {r.last_error && <div className="text-xs text-destructive max-w-56 truncate" title={r.last_error}>{r.last_error}</div>}
                    </TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => diagnose(r)}><Stethoscope className="w-4 h-4 mr-1" />Diagnóstico</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

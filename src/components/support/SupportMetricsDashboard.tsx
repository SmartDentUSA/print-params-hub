import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Timer, Hourglass, MessagesSquare, CheckCircle2, Star, ThumbsUp,
  Gauge, Inbox, TrendingUp,
} from "lucide-react";

type TicketRow = {
  id: string;
  kanban_status: string;
  created_at: string;
  queued_at: string | null;
  assigned_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
  first_contact_resolution: boolean | null;
  csat_score: number | null;
  nps_score: number | null;
  ces_score: number | null;
  assigned_user_id: string | null;
};

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

const OPEN_STATUSES = ["triagem", "fila", "em_atendimento", "aguardando_cliente", "aguardando_terceiros"];

function avgMinutes(pairs: (number | null)[]): number | null {
  const valid = pairs.filter((v): v is number => v != null && v >= 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function fmtDuration(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}min`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)}h`;
  return `${(mins / 1440).toFixed(1)}d`;
}

function fmtScore(v: number | null, suffix = ""): string {
  return v == null ? "—" : `${v.toFixed(1)}${suffix}`;
}

function diffMin(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function KpiCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="w-4 h-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold font-[Sora]">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function SupportMetricsDashboard() {
  const [days, setDays] = useState(30);
  const since = useMemo(() => new Date(Date.now() - days * 864e5).toISOString(), [days]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support_metrics", days],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_tickets")
        .select("id, kanban_status, created_at, queued_at, assigned_at, first_response_at, resolved_at, closed_at, reopened_count, first_contact_resolution, csat_score, nps_score, ces_score, assigned_user_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TicketRow[];
    },
  });

  const { data: agentNames = {} } = useQuery({
    queryKey: ["support_agent_names"],
    staleTime: 300000,
    queryFn: async () => {
      const map: Record<string, string> = {};
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      for (const p of data ?? []) map[p.id] = p.full_name || p.email || p.id.slice(0, 8);
      return map;
    },
  });

  const metrics = useMemo(() => {
    const resolved = tickets.filter((t) => t.resolved_at);
    const fcrBase = resolved.filter((t) => t.first_contact_resolution != null);
    const fcrYes = fcrBase.filter((t) => t.first_contact_resolution).length;
    const backlog = tickets.filter((t) => OPEN_STATUSES.includes(t.kanban_status));
    const surveys = tickets.filter((t) => t.csat_score != null || t.nps_score != null || t.ces_score != null);

    const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);

    return {
      total: tickets.length,
      resolved: resolved.length,
      backlog: backlog.length,
      fcr: fcrBase.length ? (fcrYes / fcrBase.length) * 100 : null,
      tma: avgMinutes(resolved.map((t) => diffMin(t.created_at, t.resolved_at))),
      tmr: avgMinutes(tickets.map((t) => diffMin(t.created_at, t.first_response_at))),
      tme: avgMinutes(tickets.map((t) => diffMin(t.queued_at ?? t.created_at, t.assigned_at))),
      csat: avg(tickets.filter((t) => t.csat_score != null).map((t) => t.csat_score!)),
      nps: avg(tickets.filter((t) => t.nps_score != null).map((t) => t.nps_score!)),
      ces: avg(tickets.filter((t) => t.ces_score != null).map((t) => t.ces_score!)),
      surveys: surveys.length,
    };
  }, [tickets]);

  const perAgent = useMemo(() => {
    const map = new Map<string, { name: string; total: number; resolved: number; fcrYes: number; fcrBase: number; tma: number[]; csat: number[] }>();
    for (const t of tickets) {
      const key = t.assigned_user_id ?? "sem-atendente";
      if (!map.has(key)) {
        map.set(key, {
          name: t.assigned_user_id ? (agentNames[t.assigned_user_id] ?? "Atendente") : "Não atribuído",
          total: 0, resolved: 0, fcrYes: 0, fcrBase: 0, tma: [], csat: [],
        });
      }
      const row = map.get(key)!;
      row.total += 1;
      if (t.resolved_at) {
        row.resolved += 1;
        const d = diffMin(t.created_at, t.resolved_at);
        if (d != null) row.tma.push(d);
      }
      if (t.first_contact_resolution != null) {
        row.fcrBase += 1;
        if (t.first_contact_resolution) row.fcrYes += 1;
      }
      if (t.csat_score != null) row.csat.push(t.csat_score);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [tickets, agentNames]);

  const volumeByDay = useMemo(() => {
    const map = new Map<string, { created: number; resolved: number }>();
    for (const t of tickets) {
      const day = t.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, { created: 0, resolved: 0 });
      map.get(day)!.created += 1;
      if (t.resolved_at) {
        const rday = t.resolved_at.slice(0, 10);
        if (!map.has(rday)) map.set(rday, { created: 0, resolved: 0 });
        map.get(rday)!.resolved += 1;
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [tickets]);

  const maxVol = Math.max(1, ...volumeByDay.map(([, v]) => Math.max(v.created, v.resolved)));

  if (isLoading) return <p className="text-sm text-muted-foreground py-10 text-center">Carregando métricas…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Período:</span>
        {PERIODS.map((p) => (
          <Button key={p.days} size="sm" variant={days === p.days ? "default" : "outline"} onClick={() => setDays(p.days)}>
            {p.label}
          </Button>
        ))}
        <Badge variant="secondary" className="ml-auto">{metrics.total} chamados no período</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={CheckCircle2} label="FCR — Resolução no 1º contato" value={metrics.fcr == null ? "—" : `${metrics.fcr.toFixed(0)}%`} hint="Resolvidos sem retorno ou reabertura" />
        <KpiCard icon={Timer} label="TMA — Tempo médio de atendimento" value={fmtDuration(metrics.tma)} hint="Da abertura à resolução" />
        <KpiCard icon={MessagesSquare} label="TMR — 1ª resposta" value={fmtDuration(metrics.tmr)} hint="Espera até o primeiro retorno do suporte" />
        <KpiCard icon={Hourglass} label="TME — Tempo médio de espera" value={fmtDuration(metrics.tme)} hint="Da fila até um atendente assumir" />
        <KpiCard icon={Star} label="CSAT — Satisfação" value={fmtScore(metrics.csat)} hint={`${metrics.surveys} pesquisas respondidas`} />
        <KpiCard icon={ThumbsUp} label="NPS — Recomendação" value={fmtScore(metrics.nps)} hint="Probabilidade de recomendar a empresa" />
        <KpiCard icon={Gauge} label="CES — Esforço do cliente" value={fmtScore(metrics.ces)} hint="Quanto esforço para resolver" />
        <KpiCard icon={Inbox} label="Backlog aberto" value={String(metrics.backlog)} hint="Chamados ainda sem solução" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Volume por dia (abertos × resolvidos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {volumeByDay.length === 0 && <p className="text-xs text-muted-foreground">Sem dados no período.</p>}
            {volumeByDay.map(([day, v]) => (
              <div key={day} className="flex items-center gap-2 text-[11px]">
                <span className="w-16 text-muted-foreground">{day.slice(5).split("-").reverse().join("/")}</span>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="h-2 rounded bg-primary/80" style={{ width: `${(v.created / maxVol) * 100}%` }} title={`${v.created} abertos`} />
                  <div className="h-2 rounded bg-emerald-500/80" style={{ width: `${(v.resolved / maxVol) * 100}%` }} title={`${v.resolved} resolvidos`} />
                </div>
                <span className="w-14 text-right text-muted-foreground">{v.created}/{v.resolved}</span>
              </div>
            ))}
            <div className="flex gap-4 pt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-primary/80 inline-block" />Abertos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/80 inline-block" />Resolvidos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Desempenho por atendente</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atendente</TableHead>
                  <TableHead className="text-right">Chamados</TableHead>
                  <TableHead className="text-right">Resolvidos</TableHead>
                  <TableHead className="text-right">FCR</TableHead>
                  <TableHead className="text-right">TMA</TableHead>
                  <TableHead className="text-right">CSAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perAgent.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-right">{a.total}</TableCell>
                    <TableCell className="text-right">{a.resolved}</TableCell>
                    <TableCell className="text-right">{a.fcrBase ? `${Math.round((a.fcrYes / a.fcrBase) * 100)}%` : "—"}</TableCell>
                    <TableCell className="text-right">{fmtDuration(avgMinutes(a.tma))}</TableCell>
                    <TableCell className="text-right">{a.csat.length ? (a.csat.reduce((x, y) => x + y, 0) / a.csat.length).toFixed(1) : "—"}</TableCell>
                  </TableRow>
                ))}
                {perAgent.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs">Sem atendimentos no período.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

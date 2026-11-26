import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  filterRecipients, orderedButtons, waOfficialAudience, waOfficialRow,
  type RecipientSegment, type TemplateButton, type WaEngagement, type WaRecipient,
} from "@/lib/waOfficialHistory";

interface Session {
  id: string; name: string; status: string | null; lead_count: number | null;
  lead_filters: Record<string, unknown> | null;
  created_at: string; started_at: string | null; completed_at: string | null; results: any;
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Na fila", variant: "secondary" },
  scheduled: { label: "Agendada", variant: "secondary" },
  running: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluída", variant: "outline" },
  completed_with_errors: { label: "Concluída c/ falhas", variant: "outline" },
  failed: { label: "Falhou", variant: "destructive" },
};
const brl = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v: string | null) => v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const num = (v: number) => v ? v.toLocaleString("pt-BR") : "—";
const pct = (a: number, b: number) => b > 0 ? `${Math.round((a / b) * 100)}%` : "";

export default function WaOfficialHistoryTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eng, setEng] = useState<Record<string, WaEngagement>>({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Session | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("campaign_sessions")
        .select("id,name,status,lead_count,lead_filters,created_at,started_at,completed_at,results")
        .eq("channel", "whatsapp_oficial")
        .in("status", ["queued", "scheduled", "running", "completed", "completed_with_errors", "failed"])
        .order("created_at", { ascending: false }).limit(100);
      if (error) { toast.error("Erro ao carregar campanhas do WhatsApp Oficial"); setLoading(false); return; }
      const list = (data as Session[]) ?? [];
      // Números ao vivo da Zernio para campanhas ainda em envio ou sem a ordem dos botões gravada.
      await Promise.all(list.map(async (c) => {
        const r = c.results ?? {};
        const ids = r.broadcast_ids ?? (r.broadcast_id ? [r.broadcast_id] : []);
        if (!ids.length) return;
        const live = ["scheduled", "running", "queued"].includes(c.status ?? "") || !r.summary || !Array.isArray(r.template_buttons);
        if (!live) return;
        const { data: st } = await supabase.functions.invoke("zernio-wa-broadcast", { body: { action: "status", campaignId: c.id } });
        if (st?.summary) c.results = { ...r, summary: st.summary, ...(st.template_buttons ? { template_buttons: st.template_buttons } : {}) };
      }));
      setSessions(list);
      if (list.length) {
        const { data: e } = await supabase.rpc("fn_wa_official_campaign_engagement" as any, { p_ids: list.map((c) => c.id) });
        const map: Record<string, WaEngagement> = {};
        for (const row of ((e as any[]) ?? [])) map[row.session_id] = row;
        setEng(map);
      }
      setLoading(false);
    })();
  }, [reload]);

  const rows = useMemo(() => sessions.map((c) => {
    const r = c.results ?? {};
    const e = eng[c.id];
    const m = waOfficialRow({ leadCount: c.lead_count, summary: r.summary, engagement: e, costPerMessage: r.cost_per_message, estimatedCost: r.estimated_cost });
    const buttons = orderedButtons(r.template_buttons as TemplateButton[] | undefined, e?.buttons);
    const audience = waOfficialAudience({ filters: c.lead_filters, segmentName: r.segment_name, snapshotRecorded: r.audience_snapshot === true });
    return { c, m, e, buttons, audience };
  }), [sessions, eng]);

  if (loading) return <div className="h-40 flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!rows.length) return <div className="py-16 text-center text-muted-foreground">Nenhuma campanha de WhatsApp Oficial disparada pelo sistema.</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs text-muted-foreground">
          Envios atualizam pela Zernio. Cliques, SAIR e "não clicou" contam leads distintos que receberam esta campanha.
          Campanhas criadas direto no painel da Zernio não aparecem aqui.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setReload((k) => k + 1)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </Button>
      </div>
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs">
              <th className="text-left p-2 font-medium">Campanha</th>
              <th className="text-left p-2 font-medium">Segmentação (público)</th>
              <th className="text-left p-2 font-medium">Status</th>
              <th className="text-right p-2 font-medium">Leads</th>
              <th className="text-right p-2 font-medium">Disparos</th>
              <th className="text-right p-2 font-medium">Sucesso<br /><span className="font-normal text-muted-foreground">entregues</span></th>
              <th className="text-right p-2 font-medium">Falha</th>
              <th className="text-right p-2 font-medium">Em andamento</th>
              <th className="text-right p-2 font-medium">Botão 1</th>
              <th className="text-right p-2 font-medium">Botão 2</th>
              <th className="text-right p-2 font-medium">Pediu SAIR</th>
              <th className="text-right p-2 font-medium">Não clicou</th>
              <th className="text-right p-2 font-medium">Custo previsto</th>
              <th className="text-right p-2 font-medium">Custo real</th>
              <th className="text-left p-2 font-medium">Criada</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, m, e, buttons, audience }) => {
              const st = STATUS[c.status ?? ""] ?? { label: c.status ?? "—", variant: "outline" as const };
              const b = (i: number) => buttons[i]
                ? <><div className="font-medium">{num(buttons[i].count)}</div><div className="text-[10px] text-muted-foreground max-w-[110px] truncate ml-auto" title={buttons[i].label}>{buttons[i].label}</div></>
                : "—";
              return (
                <tr key={c.id} className="border-b hover:bg-accent/5 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="p-2 font-medium max-w-[220px]">{c.name}</td>
                  <td className="p-2 max-w-[280px]" title={[audience.label, audience.details].filter(Boolean).join(" — ")}>
                    <div className="font-medium">{audience.label}</div>
                    {audience.details && <div className="text-[10px] text-muted-foreground line-clamp-2">{audience.details}</div>}
                  </td>
                  <td className="p-2"><Badge variant={st.variant}>{st.label}</Badge></td>
                  <td className="p-2 text-right">{num(m.leads)}</td>
                  <td className="p-2 text-right">{num(m.dispatched)}</td>
                  <td className="p-2 text-right"><div className="text-success font-medium">{num(m.delivered)}</div><div className="text-[10px] text-muted-foreground">{pct(m.delivered, m.dispatched)}</div></td>
                  <td className="p-2 text-right"><div className={m.failed ? "text-destructive font-medium" : ""}>{num(m.failed)}</div><div className="text-[10px] text-muted-foreground">{pct(m.failed, m.dispatched)}</div></td>
                  <td className="p-2 text-right">{num(m.inProgress)}</td>
                  <td className="p-2 text-right">{b(0)}</td>
                  <td className="p-2 text-right">{b(1)}</td>
                  <td className="p-2 text-right">{num(e?.sair ?? 0)}</td>
                  <td className="p-2 text-right">{num(e?.no_action ?? 0)}</td>
                  <td className="p-2 text-right">{brl(m.estimated)}</td>
                  <td className="p-2 text-right">{brl(m.real)}</td>
                  <td className="p-2 text-muted-foreground whitespace-nowrap">{dt(c.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Custo real = mensagens entregues × valor por mensagem informado no disparo (a Meta cobra a mensagem de marketing entregue).
        A Zernio não informa o valor faturado, então confira com a fatura da Meta.
      </p>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selected && (() => {
            const row = rows.find((r) => r.c.id === selected.id)!;
            return <CampaignDetail session={selected} m={row.m} e={row.e} buttons={row.buttons} />;
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}

function CampaignDetail({ session, m, e, buttons }: {
  session: Session; m: ReturnType<typeof waOfficialRow>; e: WaEngagement | undefined; buttons: { label: string; count: number }[];
}) {
  const [recipients, setRecipients] = useState<WaRecipient[] | null>(null);
  const [seg, setSeg] = useState<string>(buttons.length ? "button:0" : "no_action");

  useEffect(() => {
    (async () => {
      const all: WaRecipient[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await supabase.rpc("fn_wa_official_campaign_recipients" as any, { p_session: session.id }).range(from, from + 999);
        if (error) { toast.error("Erro ao carregar os leads da campanha"); break; }
        all.push(...((data as WaRecipient[]) ?? []));
        if (!data || (data as any[]).length < 1000) break;
      }
      setRecipients(all);
    })();
  }, [session.id]);

  const segments: { value: string; label: string }[] = [
    ...buttons.map((b, i) => ({ value: `button:${i}`, label: `Botão ${i + 1} · ${b.label} (${b.count})` })),
    { value: "sair", label: `Pediu SAIR (${e?.sair ?? 0})` },
    { value: "no_action", label: `Recebeu e não clicou em nada (${e?.no_action ?? 0})` },
    { value: "delivered", label: `Entregues (${e?.delivered ?? 0})` },
    { value: "failed", label: `Falhas (${e?.failed ?? 0})` },
    { value: "in_progress", label: "Em andamento (sem confirmação de entrega)" },
    { value: "all", label: `Todos os leads (${e?.leads ?? 0})` },
  ];
  const list = useMemo(() => {
    if (!recipients) return [];
    if (seg.startsWith("button:")) return filterRecipients(recipients, "button", buttons[Number(seg.slice(7))]?.label);
    return filterRecipients(recipients, seg as RecipientSegment);
  }, [recipients, seg, buttons]);

  const exportCsv = () => {
    const head = ["nome", "telefone", "status", "entregue_em", "lido_em", "botoes", "clicou_em", "sair_em", "erro"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = list.map((r) => [r.nome, r.telefone, r.provider_status ?? r.status, r.delivered_at, r.read_at, (r.buttons ?? []).join(" | "), r.first_click_at, r.sair_at, r.error_message].map(esc).join(";"));
    const blob = new Blob(["\uFEFF" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${session.name.replace(/[^\w-]+/g, "_")}_${seg.replace(":", "")}.csv`;
    a.click();
  };

  const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="border rounded p-3 text-center">
      <p className={`text-xl font-bold ${tone ?? ""}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <>
      <SheetHeader><SheetTitle>{session.name}</SheetTitle></SheetHeader>
      <div className="space-y-4 mt-4 text-sm">
        {session.status === "failed" && typeof session.results?.error === "string" && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-destructive">
            <p className="text-xs font-semibold">Motivo do erro</p><p>{session.results.error}</p>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Leads" value={num(m.leads)} />
          <Stat label="Disparos" value={num(m.dispatched)} />
          <Stat label="Sucesso (entregues)" value={num(m.delivered)} tone="text-success" />
          <Stat label="Falha" value={num(m.failed)} tone="text-destructive" />
          <Stat label="Em andamento" value={num(m.inProgress)} />
          <Stat label="Lidos" value={num(m.read)} tone="text-primary" />
          <Stat label="Custo previsto" value={brl(m.estimated)} />
          <Stat label="Custo real" value={brl(m.real)} />
          {buttons.map((b, i) => <Stat key={b.label} label={`Botão ${i + 1} · ${b.label}`} value={num(b.count)} tone="text-primary" />)}
          <Stat label="Pediu SAIR" value={num(e?.sair ?? 0)} />
          <Stat label="Não clicou em nada" value={num(e?.no_action ?? 0)} />
        </div>
        <div className="flex items-center gap-2">
          <Select value={seg} onValueChange={setSeg}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>{segments.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!list.length}><Download className="w-3.5 h-3.5 mr-1" /> CSV</Button>
        </div>
        {recipients == null ? <p className="text-muted-foreground text-xs">Carregando leads...</p> : (
          <div className="border rounded max-h-[50vh] overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2">Lead</th><th className="text-left p-2">Telefone</th>
                <th className="text-left p-2">Situação</th><th className="text-left p-2">Quando</th>
              </tr></thead>
              <tbody>
                {list.slice(0, 500).map((r) => (
                  <tr key={r.lead_id} className="border-b">
                    <td className="p-2">{r.nome || "—"}</td>
                    <td className="p-2">{r.telefone || "—"}</td>
                    <td className="p-2">
                      {r.buttons?.length ? r.buttons.join(", ") : r.sair_at ? "Respondeu SAIR" : r.status === "failed" ? (r.error_message || "Falhou") : r.read_at ? "Lido" : r.delivered_at ? "Entregue" : r.provider_status || r.status}
                    </td>
                    <td className="p-2 whitespace-nowrap">{dt(r.first_click_at ?? r.sair_at ?? r.read_at ?? r.delivered_at ?? r.sent_at)}</td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum lead nesta lista.</td></tr>}
              </tbody>
            </table>
            {list.length > 500 && <p className="p-2 text-[11px] text-muted-foreground">Mostrando 500 de {list.length}. Baixe o CSV para a lista completa.</p>}
          </div>
        )}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Criada: {dt(session.created_at)}{session.started_at ? ` · Iniciada: ${dt(session.started_at)}` : ""}{session.completed_at ? ` · Concluída: ${dt(session.completed_at)}` : ""}</p>
          <p>Entrega e leitura de cada lead são atualizadas de hora em hora; os totais do topo vêm da Zernio em tempo real.</p>
        </div>
      </div>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError, type User } from "@supabase/supabase-js";
import { SupportClientProfile } from "@/components/support/SupportClientProfile";
import { SupportMetricsDashboard } from "@/components/support/SupportMetricsDashboard";
import { SupportSettings } from "@/components/support/SupportSettings";
import { Helmet } from "react-helmet-async";
import { sanitizeEquipmentLabel } from "@/utils/equipmentLabel";
import { supabase } from "@/integrations/supabase/client";
import { AuthPage } from "@/components/AuthPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Headset, LogOut, RefreshCw, Search, ShieldAlert, Clock, ArrowLeft,
  Bot, User as UserIcon, Send, Loader2, Phone, Wrench, FileText,
} from "lucide-react";

export const SUPPORT_COLUMNS = [
  { key: "triagem", label: "Triagem" },
  { key: "fila", label: "Fila de espera" },
  { key: "em_atendimento", label: "Em atendimento" },
  { key: "aguardando_cliente", label: "Aguardando cliente" },
  { key: "aguardando_terceiros", label: "Aguardando terceiros" },
  { key: "resolvido", label: "Resolvido" },
  { key: "encerrado", label: "Encerrado" },
] as const;

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  baixa: "outline", normal: "secondary", alta: "default", urgente: "destructive",
};
const PRIORITY_ORDER: Record<string, number> = { urgente: 3, alta: 2, normal: 1, baixa: 0 };

type Ticket = {
  id: string;
  lead_id: string | null;
  clientFacts?: { name: string | null; phone: string | null; email: string | null; open: number; resolved: number; priority: boolean; printer: string | null };
  ticket_full_id: string;
  kanban_status: string;
  priority: string;
  equipment: string | null;
  serial_number: string | null;
  client_summary: string | null;
  ai_summary: string | null;
  created_at: string;
  last_inbound_at: string | null;
  assigned_user_id: string | null;
  ai_paused: boolean;
  lia_attendances: { nome: string | null; telefone_normalized: string | null; email: string | null } | null;
};

function useSupportAccess() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const check = async (u: User | null) => {
    setUser(u);
    if (!u) { setAllowed(false); setLoading(false); return; }
    const { data } = await supabase.rpc("is_support_staff", { _user_id: u.id });
    setAllowed(!!data);
    setLoading(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => check(session?.user ?? null), 0);
    });
    supabase.auth.getUser().then(({ data }) => check(data.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading, allowed, recheck: check };
}

function windowInfo(lastInbound: string | null) {
  if (!lastInbound) return { open: false, left: 0 };
  const left = 24 - (Date.now() - new Date(lastInbound).getTime()) / 36e5;
  return { open: left > 0, left };
}

function windowBadge(lastInbound: string | null) {
  const { open, left } = windowInfo(lastInbound);
  if (!lastInbound || !open) return <Badge variant="outline" className="text-[10px]">Janela fechada</Badge>;
  const variant = left < 4 ? "destructive" : left < 8 ? "default" : "secondary";
  return <Badge variant={variant} className="text-[10px] gap-1"><Clock className="w-3 h-3" />{Math.floor(left)}h</Badge>;
}

function waitTime(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 60) return `${mins}min`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

type ChatMessage = { id: string; from: "client" | "agent" | "ia"; text: string; at: string; media_url?: string | null };

function normalizeSender(sender: string | null | undefined): ChatMessage["from"] {
  const s = (sender || "").toLowerCase();
  if (["client", "cliente", "user", "lead", "inbound"].includes(s)) return "client";
  if (["lia", "ia", "ai", "assistant", "bot"].includes(s)) return "ia";
  return "agent";
}

function useTicketMessages(ticket: Ticket | null) {
  const phone = ticket?.lia_attendances?.telefone_normalized ?? null;
  return useQuery({
    queryKey: ["ticket_conversation", ticket?.id, phone],
    enabled: !!ticket,
    refetchInterval: 15000,
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!ticket) return [];
      const out: ChatMessage[] = [];

      const { data: tm } = await supabase
        .from("technical_ticket_messages")
        .select("id, sender, message, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      (tm ?? []).forEach((m: any) => out.push({ id: `tm-${m.id}`, from: normalizeSender(m.sender), text: m.message, at: m.created_at }));

      if (phone) {
        const { data: wa } = await supabase
          .from("whatsapp_inbox")
          .select("id, direction, message_text, media_url, created_at")
          .eq("phone_normalized", phone)
          .order("created_at", { ascending: true })
          .limit(500);
        (wa ?? []).forEach((m: any) => out.push({
          id: `wa-${m.id}`,
          from: m.direction === "inbound" ? "client" : "agent",
          text: m.message_text || (m.media_url ? "[mídia]" : ""),
          at: m.created_at,
          media_url: m.media_url,
        }));
      }

      if (out.length === 0 && Array.isArray((ticket as any).conversation_log)) {
        ((ticket as any).conversation_log as any[]).forEach((m, i) => out.push({
          id: `log-${i}`,
          from: normalizeSender(m.sender ?? m.role),
          text: m.message ?? m.text ?? m.content ?? "",
          at: m.created_at ?? m.at ?? ticket.created_at,
        }));
      }

      return out
        .filter((m) => m.text)
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
        .filter((m, i, arr) => arr.findIndex((x) => x.text === m.text && x.at === m.at) === i);
    },
  });
}

function TicketRoom({ ticket, userId, onBack }: { ticket: Ticket; userId: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: messages = [], isLoading } = useTicketMessages(ticket);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const newestInbound = messages.filter(m => m.from === "client").at(-1)?.at;
  const lastInbound = [ticket.last_inbound_at, newestInbound].filter((value): value is string => !!value).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const { open: windowOpen } = windowInfo(lastInbound);
  const clientName = ticket.clientFacts?.name || ticket.lia_attendances?.nome || "Cliente";
  const phone = ticket.clientFacts?.phone || ticket.lia_attendances?.telefone_normalized;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("support-whatsapp-send", {
      body: { ticket_id: ticket.id, message: text },
    });
    setSending(false);
    if (error || data?.error) {
      const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      toast({ title: "Falha ao enviar", description: detail?.error || data?.error || error?.message || "Envio não confirmado", variant: "destructive" });
      return;
    }
    setDraft("");
    qc.invalidateQueries({ queryKey: ["ticket_conversation", ticket.id] });
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="bg-primary text-primary-foreground px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-5 text-sm"><span className="font-semibold">Histórico do cliente</span><span>{ticket.clientFacts?.open ?? '—'} abertos</span><span>{ticket.clientFacts?.resolved ?? '—'} resolvidos</span></div>
        {ticket.clientFacts?.priority && <Badge variant="destructive" className="text-xs py-1.5">Prioritário · RayShape Edge Mini</Badge>}
      </div>
      <div className="support-room-grid grid grid-cols-1 lg:grid-cols-2 h-[calc(100dvh-240px)] min-h-[660px]">
      {/* Chat column */}
      <div className="flex-1 min-w-0 min-h-[500px] flex flex-col bg-background overflow-hidden">
        <div className="border-b px-5 py-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Kanban</Button>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{clientName}</h2>
            <p className="text-[11px] text-muted-foreground font-mono">{ticket.ticket_full_id}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {windowBadge(lastInbound)}
            {ticket.ai_paused && <Badge variant="outline" className="text-[10px]">IA pausada</Badge>}
            <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? "secondary"} className="text-[10px] capitalize">{ticket.priority}</Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-5 py-6 bg-muted/40">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando conversa…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem registrada neste chamado ainda.</p>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "client" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                    m.from === "client"
                      ? "bg-card border rounded-tl-sm"
                      : m.from === "ia"
                         ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                  }`}>
                    {m.from !== "client" && (
                      <p className="text-xs font-medium mb-1 flex items-center gap-1 text-primary-foreground/70">
                        {m.from === "ia" ? <><Bot className="w-3 h-3" />LIA (IA)</> : <><UserIcon className="w-3 h-3" />Atendente</>}
                      </p>
                    )}
                    {m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className="text-xs underline block mb-1">Ver mídia</a>}
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`text-xs mt-2 text-right ${m.from !== "client" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(m.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4 bg-card">
          {!windowOpen && (
            <p className="text-xs text-destructive mb-2">
              Janela de 24h fechada — mensagens livres não são entregues. É preciso usar um template aprovado (em breve) ou aguardar o cliente responder.
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={windowOpen ? "Escreva sua mensagem…" : "Aguardando mensagem do cliente"}
              disabled={!windowOpen || sending}
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button aria-label="Enviar mensagem" title="Enviar mensagem" onClick={send} disabled={!windowOpen || sending || !draft.trim()} size="icon" className="h-11 w-11 shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <SupportClientProfile ticketId={ticket.id} equipment={ticket.equipment} serial={ticket.serial_number}
        fallbackName={clientName} fallbackPhone={phone} fallbackEmail={ticket.clientFacts?.email || ticket.lia_attendances?.email} />
      </div>
    </div>
  );
}

function SupportKanban({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);

  const { data: tickets = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["support_tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("technical_tickets")
         .select("id, lead_id, ticket_full_id, kanban_status, priority, equipment, serial_number, client_summary, ai_summary, created_at, last_inbound_at, assigned_user_id, ai_paused, conversation_log, lia_attendances(nome, telefone_normalized, email)")
        .is("lia_attendances.merged_into", null)
        .or(`kanban_status.neq.encerrado,closed_at.gte.${new Date(Date.now() - 30 * 864e5).toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
    refetchInterval: 30000,
  });

  const { data: facts = {}, error: factsError } = useQuery({
    queryKey: ['support_board_facts', tickets.map(t => t.id).join(','), tickets.map(t => t.kanban_status).join(',')],
    enabled: tickets.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const summaries: Record<string, NonNullable<Ticket['clientFacts']>> = {};
      // One authorized ticket per client; bounded batches avoid per-card calls.
      const unique = [...new Map(tickets.filter(t => t.lead_id).map(t => [t.lead_id, t.id])).values()];
      for (let i = 0; i < unique.length; i += 40) {
        const { data, error } = await supabase.functions.invoke('support-client-context', { body: { ticket_ids: unique.slice(i, i + 40) } });
        if (error || data?.error) throw error || new Error(data.error);
        Object.assign(summaries, data.summaries);
      }
      return summaries;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.map(t => ({ ...t, clientFacts: t.lead_id ? facts[t.lead_id] : undefined })).filter((t) => {
      if (onlyMine && t.assigned_user_id !== userId) return false;
      if (!q) return true;
      return [t.ticket_full_id, t.equipment, t.serial_number, t.client_summary, t.clientFacts?.name, t.clientFacts?.phone, t.lia_attendances?.nome, t.lia_attendances?.telefone_normalized]
        .some((v) => v?.toLowerCase().includes(q));
    }).sort((a, b) => Number(b.clientFacts?.priority ?? false) - Number(a.clientFacts?.priority ?? false) || (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0) || Date.parse(a.created_at) - Date.parse(b.created_at));
  }, [tickets, facts, search, onlyMine, userId]);

  const move = async (id: string, status: string) => {
    const t = tickets.find((x) => x.id === id);
    if (!t || t.kanban_status === status) return;
    qc.setQueryData<Ticket[]>(["support_tickets"], (old) => old?.map((x) => x.id === id ? { ...x, kanban_status: status } : x));
    const patch: Record<string, unknown> = { kanban_status: status };
    if (status === "em_atendimento" && !t.assigned_user_id) {
      patch.assigned_user_id = userId;
      patch.assigned_agent_name = userEmail;
    }
    if (status === "fila") patch.queued_at = new Date().toISOString();
    const { error } = await supabase.from("technical_tickets").update(patch as any).eq("id", id);
    if (error) {
      toast({ title: "Não foi possível mover o chamado", description: error.message, variant: "destructive" });
    }
    refetch();
  };

  const assumeTicket = async (id: string) => {
    const { error } = await supabase.from("technical_tickets")
      .update({ assigned_user_id: userId, assigned_agent_name: userEmail, kanban_status: "em_atendimento", ai_paused: true } as any).eq("id", id);
    if (error) toast({ title: "Erro ao assumir", description: error.message, variant: "destructive" });
    else toast({ title: "Chamado assumido", description: "A IA foi pausada nesta conversa." });
    refetch();
  };

  if (selected) {
    const base = tickets.find((t) => t.id === selected.id) ?? selected;
    const fresh = { ...base, clientFacts: base.lead_id ? facts[base.lead_id] : undefined };
    return <TicketRoom ticket={fresh} userId={userId} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 py-3"><h2 className="text-xl font-semibold">Fila de atendimento</h2><span className="text-sm text-muted-foreground">{filtered.filter(t => t.clientFacts?.priority && !['resolvido', 'encerrado'].includes(t.kanban_status)).length} chamados prioritários</span></div>
      {factsError && <p role="alert" className="text-sm text-destructive">Não foi possível consultar o histórico e a prioridade dos clientes. <Button variant="link" onClick={() => qc.invalidateQueries({ queryKey: ['support_board_facts'] })}>Tentar novamente</Button></p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, telefone, serial ou protocolo" className="pl-8" />
        </div>
        <Button variant={onlyMine ? "default" : "outline"} size="sm" onClick={() => setOnlyMine((v) => !v)}>
          {onlyMine ? "Meus chamados" : "Fila geral"}
        </Button>
        <Button aria-label="Atualizar chamados" title="Atualizar chamados" variant="ghost" size="sm" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ['support_board_facts'] }); }} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} chamados</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando chamados…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {SUPPORT_COLUMNS.map((col) => {
            const items = filtered.filter((t) => t.kanban_status === col.key);
            return (
              <div
                key={col.key}
                className="flex-shrink-0 w-[320px] border-t-2 border-primary/40 bg-muted p-3 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) move(dragId, col.key); setDragId(null); }}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-sm font-semibold py-2">{col.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-[70vh] min-h-[120px]">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onClick={() => setSelected(t)}
                      role="button"
                       tabIndex={0}
                       onKeyDown={(e) => { if (e.key === "Enter") setSelected(t); }}
                        className={`rounded-lg border bg-card p-4 shadow-sm cursor-pointer hover:border-primary/50 focus-visible:outline-primary space-y-3 ${t.clientFacts?.priority ? 'border-l-4 border-l-destructive' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-mono text-muted-foreground">{t.ticket_full_id}</span>
                         <Badge variant={t.clientFacts?.priority ? 'destructive' : PRIORITY_VARIANT[t.priority] ?? "secondary"} className="text-xs capitalize">{t.clientFacts?.priority ? 'Prioritário' : t.priority}</Badge>
                      </div>
                       <h3 className="text-base font-semibold leading-snug break-words">{t.clientFacts?.name || t.lia_attendances?.nome || "Cliente sem nome"}</h3>
                       {(sanitizeEquipmentLabel(t.equipment) || sanitizeEquipmentLabel(t.clientFacts?.printer)) && <p className="text-sm text-primary font-medium break-words">{sanitizeEquipmentLabel(t.equipment) || sanitizeEquipmentLabel(t.clientFacts?.printer)}</p>}
                       {t.serial_number && <p className="text-xs font-mono text-muted-foreground">SN {t.serial_number}</p>}
                       {t.clientFacts?.priority && <p className="text-xs text-destructive font-semibold">Proprietário de RayShape Edge Mini</p>}
                       {t.client_summary && <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{t.client_summary}</p>}
                       <div className="grid grid-cols-2 border-y py-3 text-sm"><div><strong className="text-lg">{t.clientFacts?.open ?? '—'}</strong><span className="block text-xs text-muted-foreground">Chamados abertos</span></div><div className="border-l pl-4"><strong className="text-lg text-primary">{t.clientFacts?.resolved ?? '—'}</strong><span className="block text-xs text-muted-foreground">Resolvidos / encerrados</span></div></div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{waitTime(t.created_at)}</Badge>
                        {windowBadge(t.last_inbound_at)}
                        {t.ai_paused && <Badge variant="outline" className="text-[10px]">IA pausada</Badge>}
                        {t.assigned_user_id === userId && <Badge className="text-[10px]">Meu</Badge>}
                      </div>
                      {!t.assigned_user_id && !["resolvido", "encerrado"].includes(t.kanban_status) && (
                         <Button size="sm" variant={t.clientFacts?.priority ? 'default' : 'outline'} className="w-full h-9 text-sm" onClick={(e) => { e.stopPropagation(); assumeTicket(t.id); }}>Assumir chamado</Button>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-6">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComingSoon({ title, sprint }: { title: string; sprint: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p>Disponível na {sprint}.</p>
    </div>
  );
}

export default function SuporteTecnico() {
  const { user, loading, allowed, recheck } = useSupportAccess();

  useEffect(() => { document.title = "Suporte Técnico | Smart Dent"; }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Verificando acesso…</div>;
  if (!user) return <AuthPage onAuthSuccess={(u) => recheck(u)} />;
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-destructive" />
        <h1 className="text-xl font-semibold">Acesso restrito ao Suporte Técnico</h1>
        <p className="text-sm text-muted-foreground max-w-md">Sua conta não tem o perfil de atendente de suporte. Peça a um administrador para liberar o acesso.</p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
      </div>
    );
  }

  return (
    <div className="support-workspace min-h-screen bg-background text-foreground">
      <Helmet><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" /></Helmet>
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Headset className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Suporte Técnico</h1>
        <Link to="/smartops">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Painel</Button>
        </Link>
        <span className="text-xs text-muted-foreground ml-auto">{user.email}</span>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}><LogOut className="w-4 h-4" /></Button>
      </header>
      <main className="p-4 lg:p-6">
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Chamados (Kanban)</TabsTrigger>
            <TabsTrigger value="bi">BI & Métricas</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="mt-4"><SupportKanban userId={user.id} userEmail={user.email ?? ""} /></TabsContent>
          <TabsContent value="bi" className="mt-4"><SupportMetricsDashboard /></TabsContent>
          <TabsContent value="config" className="mt-4"><SupportSettings /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

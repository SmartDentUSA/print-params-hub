import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthPage } from "@/components/AuthPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Headset, LogOut, RefreshCw, Search, ShieldAlert, Clock, ArrowLeft, Bot, User as UserIcon } from "lucide-react";

export const SUPPORT_COLUMNS = [
  { key: "triagem", label: "Triagem / Novo (IA)" },
  { key: "fila", label: "Fila de espera" },
  { key: "em_atendimento", label: "Em atendimento" },
  { key: "aguardando_cliente", label: "Aguardando cliente" },
  { key: "aguardando_terceiros", label: "Aguardando peça / terceiros" },
  { key: "resolvido", label: "Resolvido (CSAT)" },
  { key: "encerrado", label: "Encerrado" },
] as const;

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  baixa: "outline", normal: "secondary", alta: "default", urgente: "destructive",
};

type Ticket = {
  id: string;
  ticket_full_id: string;
  kanban_status: string;
  priority: string;
  equipment: string | null;
  serial_number: string | null;
  client_summary: string | null;
  created_at: string;
  last_inbound_at: string | null;
  assigned_user_id: string | null;
  ai_paused: boolean;
  lia_attendances: { nome: string | null; telefone_normalized: string | null } | null;
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

function windowBadge(lastInbound: string | null) {
  if (!lastInbound) return null;
  const hours = (Date.now() - new Date(lastInbound).getTime()) / 36e5;
  const left = 24 - hours;
  if (left <= 0) return <Badge variant="outline" className="text-[10px]">Janela fechada</Badge>;
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

function TicketConversation({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const phone = ticket?.lia_attendances?.telefone_normalized ?? null;

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["ticket_conversation", ticket?.id, phone],
    enabled: !!ticket,
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

  return (
    <Sheet open={!!ticket} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm flex items-center gap-2">
            {ticket?.lia_attendances?.nome || "Cliente"}
            <span className="font-mono text-xs text-muted-foreground">{ticket?.ticket_full_id}</span>
          </SheetTitle>
          {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
        </SheetHeader>
        <ScrollArea className="flex-1 px-4 py-3 bg-muted/30">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando conversa…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem registrada neste chamado ainda.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "client" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.from === "client"
                      ? "bg-card border rounded-tl-sm"
                      : m.from === "ia"
                        ? "bg-primary/10 border border-primary/20 rounded-tr-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                  }`}>
                    {m.from !== "client" && (
                      <p className={`text-[10px] font-medium mb-0.5 flex items-center gap-1 ${m.from === "agent" ? "text-primary-foreground/70" : "text-primary"}`}>
                        {m.from === "ia" ? <><Bot className="w-3 h-3" />LIA (IA)</> : <><UserIcon className="w-3 h-3" />Atendente</>}
                      </p>
                    )}
                    {m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className="text-xs underline block mb-1">Ver mídia</a>}
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`text-[10px] mt-1 text-right ${m.from === "agent" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(m.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SupportKanban({ userId }: { userId: string }) {
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
        .select("id, ticket_full_id, kanban_status, priority, equipment, serial_number, client_summary, created_at, last_inbound_at, assigned_user_id, ai_paused, lia_attendances(nome, telefone_normalized)")
        .or(`kanban_status.neq.encerrado,closed_at.gte.${new Date(Date.now() - 30 * 864e5).toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (onlyMine && t.assigned_user_id !== userId) return false;
      if (!q) return true;
      return [t.ticket_full_id, t.equipment, t.serial_number, t.client_summary, t.lia_attendances?.nome, t.lia_attendances?.telefone_normalized]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [tickets, search, onlyMine, userId]);

  const move = async (id: string, status: string) => {
    const t = tickets.find((x) => x.id === id);
    if (!t || t.kanban_status === status) return;
    qc.setQueryData<Ticket[]>(["support_tickets"], (old) => old?.map((x) => x.id === id ? { ...x, kanban_status: status } : x));
    const patch: Record<string, unknown> = { kanban_status: status };
    if (status === "em_atendimento" && !t.assigned_user_id) patch.assigned_user_id = userId;
    if (status === "fila") patch.queued_at = new Date().toISOString();
    const { error } = await supabase.from("technical_tickets").update(patch as any).eq("id", id);
    if (error) {
      toast({ title: "Não foi possível mover o chamado", description: error.message, variant: "destructive" });
    }
    refetch();
  };

  const assumeTicket = async (id: string) => {
    const { error } = await supabase.from("technical_tickets")
      .update({ assigned_user_id: userId, kanban_status: "em_atendimento", ai_paused: true } as any).eq("id", id);
    if (error) toast({ title: "Erro ao assumir", description: error.message, variant: "destructive" });
    else toast({ title: "Chamado assumido", description: "A IA foi pausada nesta conversa." });
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, telefone, serial ou protocolo" className="pl-8" />
        </div>
        <Button variant={onlyMine ? "default" : "outline"} size="sm" onClick={() => setOnlyMine((v) => !v)}>
          {onlyMine ? "Meus chamados" : "Fila geral"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
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
                className="flex-shrink-0 w-64 rounded-lg border bg-muted/40 p-2 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) move(dragId, col.key); setDragId(null); }}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-semibold">{col.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-[70vh] min-h-[120px]">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      className="rounded-md border bg-card p-2 shadow-sm cursor-grab active:cursor-grabbing space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-mono text-muted-foreground">{t.ticket_full_id}</span>
                        <Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"} className="text-[10px] capitalize">{t.priority}</Badge>
                      </div>
                      <p className="text-sm font-medium leading-tight truncate">{t.lia_attendances?.nome || "Cliente sem nome"}</p>
                      {t.equipment && <p className="text-xs text-muted-foreground truncate">{t.equipment}{t.serial_number ? ` · SN ${t.serial_number}` : ""}</p>}
                      {t.client_summary && <p className="text-xs line-clamp-2">{t.client_summary}</p>}
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{waitTime(t.created_at)}</Badge>
                        {windowBadge(t.last_inbound_at)}
                        {t.ai_paused && <Badge variant="outline" className="text-[10px]">IA pausada</Badge>}
                        {t.assigned_user_id === userId && <Badge className="text-[10px]">Meu</Badge>}
                      </div>
                      {!t.assigned_user_id && !["resolvido", "encerrado"].includes(t.kanban_status) && (
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => assumeTicket(t.id)}>Assumir</Button>
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
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Headset className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Suporte Técnico</h1>
        <Link to="/smartops">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Painel</Button>
        </Link>
        <span className="text-xs text-muted-foreground ml-auto">{user.email}</span>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}><LogOut className="w-4 h-4" /></Button>
      </header>
      <main className="p-4">
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Chamados (Kanban)</TabsTrigger>
            <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
            <TabsTrigger value="bi">BI & Métricas</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="mt-4"><SupportKanban userId={user.id} /></TabsContent>
          <TabsContent value="atendimento" className="mt-4"><ComingSoon title="Sala de atendimento em 3 colunas" sprint="Sprint 3" /></TabsContent>
          <TabsContent value="bi" className="mt-4"><ComingSoon title="Dashboard de KPIs (FCR, TMA, TMR, TME, CSAT, NPS, CES, Backlog)" sprint="Sprint 5" /></TabsContent>
          <TabsContent value="config" className="mt-4"><ComingSoon title="Categorias, tipos, checklists e respostas rápidas" sprint="Sprint 5" /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

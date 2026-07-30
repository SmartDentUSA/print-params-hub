import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Search, MessageSquare, Phone, User, RefreshCw, DownloadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InboxMessage {
  id: string;
  created_at: string;
  phone: string;
  phone_normalized: string | null;
  message_text: string | null;
  media_url: string | null;
  media_type: string | null;
  direction: string;
  lead_id: string | null;
  intent_detected: string | null;
  confidence_score: number | null;
  instance_name?: string | null;
  sender_name?: string | null;
  is_group?: boolean | null;
}

interface Conversation {
  phone_normalized: string;
  phone_raw: string;
  last_message: string;
  last_at: string;
  lead_name: string | null;
  lead_id: string | null;
  intent: string | null;
  unread_count: number;
  instance_name: string | null;
  is_group: boolean;
  funil: string | null;
  vendedor: string | null;
  treinamento: string | null;
}

interface TeamMember {
  id: string;
  nome_completo: string;
  whatsapp_number: string | null;
  evolution_instance_name: string | null;
}

export function SmartOpsWhatsAppInbox({ refreshKey }: { refreshKey: number }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load conversations grouped by phone
  useEffect(() => {
    loadConversations();
    loadTeamMembers();
  }, [refreshKey]);

  // Polling: reload conversations every 8s
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadConversations();
      if (selectedPhone) loadMessages(selectedPhone);
    }, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedPhone]);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (selectedPhone) loadMessages(selectedPhone);
  }, [selectedPhone]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_inbox")
      .select("phone_normalized, phone, message_text, created_at, direction, lead_id, intent_detected, instance_name, is_group")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Error loading inbox:", error);
      setLoading(false);
      return;
    }

    const map = new Map<string, Conversation>();
    for (const msg of data || []) {
      const key = msg.phone_normalized || msg.phone;
      if (!map.has(key)) {
        map.set(key, {
          phone_normalized: key,
          phone_raw: msg.phone,
          last_message: msg.message_text || `[${msg.direction}]`,
          last_at: msg.created_at,
          lead_name: null,
          lead_id: msg.lead_id,
          intent: msg.intent_detected,
          unread_count: 0,
          instance_name: (msg as any).instance_name ?? null,
          is_group: Boolean((msg as any).is_group),
          funil: null,
          vendedor: null,
          treinamento: null,
        });
      }
    }

    const convs = [...map.values()];
    const last8 = (v?: string | null) => (v || "").replace(/\D/g, "").slice(-8);

    const leadIds = [...new Set(convs.filter(c => c.lead_id).map(c => c.lead_id!))];
    const phoneKeys = [...new Set(
      convs
        .filter(c => !c.is_group)
        .map(c => (c.phone_normalized || c.phone_raw || "").replace(/\D/g, ""))
        // Ignora identificadores internos do WhatsApp (@lid) — não são telefones
        .filter(p => p.length >= 12)
    )];

    const leadRows: any[] = [];
    if (leadIds.length > 0) {
      const { data } = await supabase
        .from("lia_attendances")
        .select("id, nome, telefone_normalized, telefone_raw, piperun_pipeline_name, funil_entrada_crm, piperun_stage_name, proprietario_lead_crm, cs_treinamento, data_treinamento")
        .in("id", leadIds);
      if (data) leadRows.push(...data);
    }
    if (phoneKeys.length > 0) {
      // lia_attendances.telefone_normalized é gravado como "+55DDXXXXXXXXX"
      const variants = [...new Set(phoneKeys.flatMap(p => {
        const base = p.startsWith("55") ? p : "55" + p;
        return [`+${base}`, base, `+${base.slice(2)}`];
      }))];
      const { data } = await supabase
        .from("lia_attendances")
        .select("id, nome, telefone_normalized, telefone_raw, piperun_pipeline_name, funil_entrada_crm, piperun_stage_name, proprietario_lead_crm, cs_treinamento, data_treinamento")
        .is("merged_into", null)
        .in("telefone_normalized", variants.slice(0, 400));
      if (data) leadRows.push(...data);
    }

    const byId = new Map(leadRows.map(l => [l.id, l]));
    const byPhone = new Map<string, any>();
    for (const l of leadRows) {
      const k = last8(l.telefone_normalized || l.telefone_raw);
      if (k && !byPhone.has(k)) byPhone.set(k, l);
    }

    for (const conv of convs) {
      const lead = (conv.lead_id && byId.get(conv.lead_id)) || (!conv.is_group ? byPhone.get(last8(conv.phone_normalized || conv.phone_raw)) : null);
      if (!lead) continue;
      conv.lead_id = conv.lead_id || lead.id;
      conv.lead_name = lead.nome || conv.lead_name;
      conv.funil = lead.piperun_pipeline_name || lead.funil_entrada_crm || null;
      conv.vendedor = lead.proprietario_lead_crm || null;
      conv.treinamento = lead.cs_treinamento
        ? `${lead.cs_treinamento}${lead.data_treinamento ? ` • ${new Date(lead.data_treinamento).toLocaleDateString("pt-BR")}` : ""}`
        : null;
    }

    // Status de treinamento vindo das matrículas (timeline de cursos)
    const enrichIds = [...new Set(convs.filter(c => c.lead_id).map(c => c.lead_id!))];
    if (enrichIds.length > 0) {
      const { data: enrolls } = await supabase
        .from("smartops_course_enrollments")
        .select("lead_id, status, turma_snapshot, enrolled_at")
        .in("lead_id", enrichIds)
        .order("enrolled_at", { ascending: false });
      if (enrolls) {
        const eMap = new Map<string, any>();
        for (const e of enrolls) if (e.lead_id && !eMap.has(e.lead_id)) eMap.set(e.lead_id, e);
        for (const conv of convs) {
          if (!conv.lead_id) continue;
          const e = eMap.get(conv.lead_id);
          if (!e) continue;
          const curso = (e.turma_snapshot as any)?.course_name || (e.turma_snapshot as any)?.curso || "";
          conv.treinamento = `${e.status || "matriculado"}${curso ? ` • ${curso}` : ""}`;
        }
      }
    }

    setConversations(convs);
    setLoading(false);
  };

  const loadMessages = async (phone: string) => {
    const { data, error } = await supabase
      .from("whatsapp_inbox")
      .select("*")
      .or(`phone_normalized.eq.${phone},phone.eq.${phone}`)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }
    setMessages((data as InboxMessage[]) || []);
  };

  const loadTeamMembers = async () => {
    const { data } = await supabase
      .from("team_members")
      .select("id, nome_completo, whatsapp_number, evolution_instance_name")
      .eq("ativo", true)
      .not("evolution_instance_name", "is", null);
    if (data) {
      setTeamMembers(data);
      if (data.length > 0) setSelectedMember(data[0].id);
    }
  };

  const handleSyncInstances = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-wa-capture-conversations", {
        body: { since_hours: 168, pages: 5, page_size: 200 },
      });
      if (error) throw error;
      const res = (data as any)?.results ?? [];
      const inserted = res.reduce((a: number, r: any) => a + (r.inserted || 0), 0);
      const failed = res.filter((r: any) => r.error);
      toast.success(`${inserted} mensagens capturadas de ${res.length} instância(s)`);
      if (failed.length) {
        toast.warning(`Instâncias com erro: ${failed.map((f: any) => f.instance).join(", ")}`);
      }
      loadConversations();
    } catch (err) {
      toast.error(`Erro ao sincronizar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  const [resolving, setResolving] = useState(false);

  const handleResolveIdentities = async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-wa-resolve-lid", {
        body: { dry_run: false, limit: 5000, enable_name_match: false },
      });
      if (error) throw error;
      const d = data as any;
      toast.success(`${d?.updated_rows ?? 0} conversas vinculadas por telefone`);
      loadConversations();
    } catch (err) {
      toast.error(`Erro ao resolver identidades: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResolving(false);
    }
  };

  const handleSend = async () => {
    if (!replyText.trim() || !selectedPhone || !selectedMember) return;
    setSending(true);

    try {
      const conv = conversations.find(c => c.phone_normalized === selectedPhone);

      const { data, error } = await supabase.functions.invoke("smart-ops-send-waleads", {
        body: {
          team_member_id: selectedMember,
          phone: conv?.phone_raw || selectedPhone,
          tipo: "text",
          message: replyText,
          lead_id: conv?.lead_id || null,
        },
      });

      if (error) {
        // Lê o corpo JSON do erro para exibir a causa real (ex.: instância desconectada)
        let detail = error.message;
        const res = (error as any)?.context;
        if (res && typeof res.json === "function") {
          const bodyErr = await res.json().catch(() => null);
          if (bodyErr?.detail) detail = bodyErr.detail;
          else if (bodyErr?.error) detail = bodyErr.error;
        }
        throw new Error(detail);
      }
      if (data && (data as any).success === false) {
        throw new Error((data as any).detail || (data as any).error);
      }
      toast.success("Mensagem enviada");
      setReplyText("");
      setTimeout(() => loadMessages(selectedPhone), 1000);
    } catch (err) {
      toast.error(`Erro ao enviar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  // Enhanced search: match full phone, DDD+9, or last 9 digits
  const instanceOptions = [...new Set(conversations.map(c => c.instance_name).filter(Boolean))] as string[];

  const filteredConversations = conversations.filter(c => {
    if (instanceFilter !== "all" && c.instance_name !== instanceFilter) return false;
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase().replace(/\D/g, "");
    const qText = searchFilter.toLowerCase();

    // Text match on name/message
    if (c.lead_name && c.lead_name.toLowerCase().includes(qText)) return true;
    if (c.last_message && c.last_message.toLowerCase().includes(qText)) return true;
    if (c.vendedor && c.vendedor.toLowerCase().includes(qText)) return true;
    if (c.funil && c.funil.toLowerCase().includes(qText)) return true;

    // Phone match: full, DDD+9, or last 9 digits
    if (!q) return true;
    const phoneDigits = (c.phone_raw || c.phone_normalized || "").replace(/\D/g, "");
    if (phoneDigits.includes(q)) return true;
    if (q.length >= 8 && phoneDigits.endsWith(q)) return true;

    return false;
  });

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const intentColor = (intent: string | null) => {
    if (!intent) return "";
    if (intent.includes("interesse")) return "bg-green-100 text-green-800 border-green-200";
    if (intent.includes("suporte")) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (intent.includes("sem_interesse")) return "bg-red-100 text-red-800 border-red-200";
    return "bg-muted text-muted-foreground";
  };

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    return raw;
  };

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] border rounded-lg bg-card overflow-hidden">
      {/* Left: Conversation list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou telefone..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Select value={instanceFilter} onValueChange={setInstanceFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Todas as instâncias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instâncias</SelectItem>
                {instanceOptions.map((inst) => (
                  <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={handleSyncInstances}
              disabled={syncing}
              title="Capturar conversas de todas as instâncias (vendedor, CS e suporte)"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Nenhuma conversa encontrada</div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.phone_normalized}
                onClick={() => setSelectedPhone(conv.phone_normalized)}
                className={cn(
                  "w-full text-left p-3 border-b hover:bg-accent/50 transition-colors",
                  selectedPhone === conv.phone_normalized && "bg-accent"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate flex items-center gap-1.5">
                    {conv.lead_name ? (
                      <>
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {conv.lead_name}
                      </>
                    ) : (
                      <>
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {formatPhone(conv.phone_raw)}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {formatTime(conv.last_at)}
                  </span>
                </div>
                {conv.lead_name && (
                  <p className="text-[10px] text-muted-foreground mb-0.5">📱 {formatPhone(conv.phone_raw)}</p>
                )}
                {(conv.funil || conv.vendedor || conv.treinamento) && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {conv.funil && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">
                        🎯 {conv.funil}
                      </Badge>
                    )}
                    {conv.vendedor && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-300 text-purple-700 bg-purple-50">
                        👤 {conv.vendedor}
                      </Badge>
                    )}
                    {conv.treinamento && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">
                        🎓 {conv.treinamento}
                      </Badge>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                {conv.instance_name && (
                  <Badge variant="secondary" className="mt-1 mr-1 text-[9px] px-1.5 py-0">
                    {conv.instance_name}{conv.is_group ? " • grupo" : ""}
                  </Badge>
                )}
                {conv.intent && (
                  <Badge variant="outline" className={cn("mt-1 text-[10px] px-1.5 py-0", intentColor(conv.intent))}>
                    {conv.intent}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
          <span>{conversations.length} conversas</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => loadConversations()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={handleResolveIdentities}
            disabled={resolving}
            title="Resolver identidades (LID → lead)"
          >
            {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
            <span className="ml-1">Resolver identidades</span>
          </Button>
        </div>
      </div>

      {/* Right: Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedPhone ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione uma conversa para visualizar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="p-3 border-b flex items-center justify-between bg-muted/30">
              <div>
                <p className="font-medium text-sm">
                  {conversations.find(c => c.phone_normalized === selectedPhone)?.lead_name || formatPhone(conversations.find(c => c.phone_normalized === selectedPhone)?.phone_raw || selectedPhone)}
                </p>
                <p className="text-xs text-muted-foreground">
                  📱 {formatPhone(conversations.find(c => c.phone_normalized === selectedPhone)?.phone_raw || selectedPhone)}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {messages.length} msgs
              </Badge>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    msg.direction === "inbound"
                      ? "bg-muted mr-auto"
                      : "bg-primary text-primary-foreground ml-auto"
                  )}
                >
                  {msg.media_url && (
                    <div className="mb-1">
                      {msg.media_type?.startsWith("image") ? (
                        <img src={msg.media_url} alt="media" className="max-w-full rounded max-h-48" />
                      ) : (
                        <a href={msg.media_url} target="_blank" rel="noreferrer" className="underline text-xs">
                          📎 {msg.media_type || "arquivo"}
                        </a>
                      )}
                    </div>
                  )}
                  {msg.message_text && <p className="whitespace-pre-wrap">{msg.message_text}</p>}
                  <div className={cn(
                    "flex items-center gap-2 mt-1",
                    msg.direction === "inbound" ? "justify-start" : "justify-end"
                  )}>
                    <span className="text-[10px] opacity-70">{formatTime(msg.created_at)}</span>
                    {msg.intent_detected && msg.direction === "inbound" && (
                      <Badge variant="outline" className={cn("text-[9px] px-1 py-0", intentColor(msg.intent_detected))}>
                        {msg.intent_detected}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply area */}
            <div className="p-3 border-t space-y-2">
              <div className="flex items-center gap-2">
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Selecionar remetente" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {teamMembers.find(m => m.id === selectedMember)?.whatsapp_number || ""}
                </span>
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[60px] max-h-[120px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim() || !selectedMember}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

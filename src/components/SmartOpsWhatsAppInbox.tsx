import { useState, useEffect, useRef } from "react";
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
import { Send, Search, MessageSquare, Phone, User } from "lucide-react";
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
}

interface Conversation {
  phone_normalized: string;
  last_message: string;
  last_at: string;
  lead_name: string | null;
  lead_id: string | null;
  intent: string | null;
  unread_count: number;
}

interface TeamMember {
  id: string;
  nome_completo: string;
  whatsapp_number: string | null;
  waleads_api_key: string | null;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations grouped by phone
  useEffect(() => {
    loadConversations();
    loadTeamMembers();
  }, [refreshKey]);

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
    // Get all messages ordered by created_at desc, then group client-side
    const { data, error } = await supabase
      .from("whatsapp_inbox")
      .select("phone_normalized, phone, message_text, created_at, direction, lead_id, intent_detected")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Error loading inbox:", error);
      setLoading(false);
      return;
    }

    // Group by phone_normalized
    const map = new Map<string, Conversation>();
    for (const msg of data || []) {
      const key = msg.phone_normalized || msg.phone;
      if (!map.has(key)) {
        map.set(key, {
          phone_normalized: key,
          last_message: msg.message_text || `[${msg.direction}]`,
          last_at: msg.created_at,
          lead_name: null,
          lead_id: msg.lead_id,
          intent: msg.intent_detected,
          unread_count: 0,
        });
      }
    }

    // Fetch lead names for conversations that have lead_id
    const leadIds = [...new Set([...map.values()].filter(c => c.lead_id).map(c => c.lead_id!))];
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, nome")
        .in("id", leadIds);
      if (leads) {
        const leadMap = new Map(leads.map(l => [l.id, l.nome]));
        for (const conv of map.values()) {
          if (conv.lead_id) conv.lead_name = leadMap.get(conv.lead_id) || null;
        }
      }
    }

    setConversations([...map.values()]);
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
      .select("id, nome_completo, whatsapp_number, waleads_api_key")
      .eq("ativo", true)
      .not("waleads_api_key", "is", null);
    if (data) {
      setTeamMembers(data);
      if (data.length > 0) setSelectedMember(data[0].id);
    }
  };

  const handleSend = async () => {
    if (!replyText.trim() || !selectedPhone || !selectedMember) return;
    setSending(true);

    try {
      // Find the lead_id for this conversation
      const conv = conversations.find(c => c.phone_normalized === selectedPhone);

      const { error } = await supabase.functions.invoke("smart-ops-send-waleads", {
        body: {
          team_member_id: selectedMember,
          phone: selectedPhone,
          tipo: "text",
          message: replyText,
          lead_id: conv?.lead_id || null,
        },
      });

      if (error) throw error;
      toast.success("Mensagem enviada");
      setReplyText("");
      // Reload messages after small delay
      setTimeout(() => loadMessages(selectedPhone), 1000);
    } catch (err) {
      toast.error(`Erro ao enviar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.phone_normalized.includes(q) ||
      (c.lead_name && c.lead_name.toLowerCase().includes(q)) ||
      (c.last_message && c.last_message.toLowerCase().includes(q))
    );
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

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] border rounded-lg bg-card overflow-hidden">
      {/* Left: Conversation list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9"
            />
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
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        {conv.lead_name}
                      </>
                    ) : (
                      <>
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        {conv.phone_normalized}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {formatTime(conv.last_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                {conv.intent && (
                  <Badge variant="outline" className={cn("mt-1 text-[10px] px-1.5 py-0", intentColor(conv.intent))}>
                    {conv.intent}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t text-xs text-muted-foreground text-center">
          {conversations.length} conversas
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
                  {conversations.find(c => c.phone_normalized === selectedPhone)?.lead_name || selectedPhone}
                </p>
                <p className="text-xs text-muted-foreground">{selectedPhone}</p>
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

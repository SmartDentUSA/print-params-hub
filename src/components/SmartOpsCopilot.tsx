import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send, Mic, MicOff, Paperclip, Bot, User, Loader2, Sparkles, Zap, Brain
} from "lucide-react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";

type Message = { role: "user" | "assistant"; content: string };
type ModelId = "deepseek" | "gemini";

const SUGGESTIONS = [
  "Quantos leads temos no total?",
  "Leads sem follow-up há 7 dias",
  "Campos faltantes dos leads quentes",
  "Leads por cidade — top 10",
  "Buscar vídeos sobre impressora 3D",
  "Score médio dos leads",
];

export function SmartOpsCopilot() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem("copilot-chat-history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("deepseek");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("copilot-chat-history", JSON.stringify(messages));
    } catch { /* storage full, ignore */ }
  }, [messages]);

  // ─── Realtime: listen for new leads from webhook ───
  useEffect(() => {
    const channel = supabase
      .channel("copilot-new-leads")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lia_attendances" },
        (payload) => {
          const lead = payload.new as Record<string, unknown>;
          const nome = lead.nome || "Desconhecido";
          const email = lead.email || "—";
          const source = lead.source || "—";
          const produto = lead.produto_interesse || "—";
          const cidade = lead.cidade || "";
          const uf = lead.uf || "";
          const loc = [cidade, uf].filter(Boolean).join("/") || "—";

          const alertMsg = `🚨 **Novo lead chegou!**\n\n` +
            `| Campo | Valor |\n|---|---|\n` +
            `| **Nome** | ${nome} |\n` +
            `| **Email** | ${email} |\n` +
            `| **Origem** | ${source} |\n` +
            `| **Produto** | ${produto} |\n` +
            `| **Local** | ${loc} |\n\n` +
            `_Recebido agora via webhook._`;

          setMessages((prev) => [...prev, { role: "assistant", content: alertMsg }]);
          toast.success(`Novo lead: ${nome}`, { description: String(email) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Speech Recognition setup
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error !== "aborted") {
        toast.error("Erro no reconhecimento de voz");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const toggleVoice = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // Stream chat
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-ops-copilot`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, model: selectedModel }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || `Erro ${resp.status}`);
      }

      const contentType = resp.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && resp.body) {
        // SSE streaming
        let assistantContent = "";
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                  }
                  return [...prev, { role: "assistant", content: assistantContent }];
                });
              }
            } catch {
              // partial JSON, ignore
            }
          }
        }

        if (!assistantContent) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Operação concluída." }]);
        }
      } else {
        // JSON response
        const data = await resp.json();
        const content = data.content || data.error || "Sem resposta";
        setMessages((prev) => [...prev, { role: "assistant", content }]);
      }
    } catch (e) {
      console.error("Copilot error:", e);
      toast.error("Erro ao comunicar com o Copilot");
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ Erro: ${e instanceof Error ? e.message : "Falha na comunicação"}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // CSV upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvText = ev.target?.result as string;
      setInput(`Importar este CSV:\n${csvText.slice(0, 2000)}`);
      toast.success(`CSV "${file.name}" carregado`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Simple markdown renderer
  const renderContent = (text: string) => {
    // Handle tables
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let tableLines: string[] = [];
    let inTable = false;

    const flushTable = () => {
      if (tableLines.length < 2) {
        tableLines.forEach((l, i) => elements.push(<p key={`t-${elements.length}-${i}`}>{l}</p>));
        tableLines = [];
        return;
      }
      const headers = tableLines[0].split("|").filter(Boolean).map(h => h.trim());
      const rows = tableLines.slice(2).map(r => r.split("|").filter(Boolean).map(c => c.trim()));
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-2">
          <table className="min-w-full text-xs border border-border rounded">
            <thead><tr className="bg-muted">{headers.map((h, i) => <th key={i} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map((row, ri) => <tr key={ri} className="border-t border-border">{row.map((c, ci) => <td key={ci} className="px-2 py-1">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      tableLines = [];
    };

    lines.forEach((line, idx) => {
      if (line.includes("|") && line.trim().startsWith("|")) {
        if (!inTable) inTable = true;
        tableLines.push(line);
      } else {
        if (inTable) { flushTable(); inTable = false; }
        if (line.startsWith("### ")) {
          elements.push(<h3 key={idx} className="font-bold text-sm mt-2">{line.slice(4)}</h3>);
        } else if (line.startsWith("## ")) {
          elements.push(<h2 key={idx} className="font-bold text-base mt-2">{line.slice(3)}</h2>);
        } else if (line.startsWith("**") && line.endsWith("**")) {
          elements.push(<p key={idx} className="font-semibold text-sm">{line.slice(2, -2)}</p>);
        } else if (line.startsWith("- ") || line.startsWith("• ")) {
          elements.push(<li key={idx} className="ml-4 text-sm list-disc">{line.slice(2)}</li>);
        } else if (line.trim()) {
          // Bold inline
          const parts = line.split(/(\*\*.*?\*\*)/g);
          elements.push(
            <p key={idx} className="text-sm">
              {parts.map((part, pi) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={pi}>{part.slice(2, -2)}</strong>
                  : part
              )}
            </p>
          );
        } else {
          elements.push(<div key={idx} className="h-1" />);
        }
      }
    });
    if (inTable) flushTable();

    return <div className="space-y-0.5">{elements}</div>;
  };

  return (
    <Card className="h-[calc(100vh-220px)] flex flex-col">
      {/* Model selector header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">Modelo IA</span>
        <ToggleGroup
          type="single"
          value={selectedModel}
          onValueChange={(v) => { if (v) setSelectedModel(v as ModelId); }}
          size="sm"
        >
          <ToggleGroupItem value="deepseek" className="text-xs gap-1 px-2.5 h-7">
            <Zap className="w-3 h-3" />
            DeepSeek
          </ToggleGroupItem>
          <ToggleGroupItem value="gemini" className="text-xs gap-1 px-2.5 h-7">
            <Brain className="w-3 h-3" />
            Gemini
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Copilot IA</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Seu assistente operacional. Pergunte sobre leads, envie mensagens, crie públicos, importe dados — tudo por texto ou voz.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent transition-colors px-3 py-1.5 text-xs"
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    {msg.role === "assistant" ? renderContent(msg.content) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-3 flex gap-2 items-center bg-card">
          <input
            type="file"
            accept=".csv"
            ref={fileRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0"
            title="Importar CSV"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "🎙️ Ouvindo..." : "Digite ou fale um comando..."}
            disabled={isLoading}
            className={`flex-1 ${isListening ? "border-red-400 ring-1 ring-red-400" : ""}`}
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVoice}
            disabled={isLoading}
            className={`flex-shrink-0 transition-all ${isListening ? "text-red-500 animate-pulse" : ""}`}
            title={isListening ? "Parar gravação" : "Falar"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>

          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send, Mic, MicOff, Paperclip, Bot, User, Loader2, Sparkles, Zap, Brain, Rocket, Check, X, ClipboardCheck,
  LayoutGrid, ExternalLink, MessageSquarePlus, RotateCcw, MapPin
} from "lucide-react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { CopilotSystemMenu } from "@/components/copilot/CopilotSystemMenu";
import {
  findSection, buildMenuContext, menuPath, parseOptions, OPTIONS_BLOCK_RE,
  type MenuContext, type CopilotAction,
} from "@/components/copilot/copilotMenu";

type MenuPayload =
  | { kind: "sections" }
  | { kind: "subtabs"; sectionId: string }
  | { kind: "actions"; sectionId: string; subtabId: string };
// local = mensagem só da tela (menu), nunca enviada ao modelo.
type Message = { role: "user" | "assistant"; content: string; local?: boolean; menu?: MenuPayload };
type ModelId = "deepseek-pro" | "deepseek-flash" | "gemini" | "claude";
// Claude está oculto do seletor (custo ~20× DeepSeek). Reativar requer COPILOT_ALLOW_CLAUDE=true no edge.

const CREATION_SUGGESTIONS = [
  "Quero criar uma campanha de Black Friday",
  "Criar tabela promocional",
  "Criar campanha para grupos de WhatsApp",
];

const ACTION_BLOCK_RE = /```copilot-action\n([\s\S]*?)\n```/g;
type ActionRef = { id: string; type: string; title: string };
type ActionStatus = "loading" | "done" | "cancelled" | "failed";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Faça login para usar o Copilot.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function readError(resp: Response) {
  const txt = await resp.text();
  try { return JSON.parse(txt)?.error || txt; } catch { return txt || `Erro ${resp.status}`; }
}

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
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>(() => {
    try { return JSON.parse(localStorage.getItem("copilot-action-status") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("copilot-action-status", JSON.stringify(actionStatus)); } catch { /* ignore */ }
  }, [actionStatus]);
  const [activeMenu, setActiveMenu] = useState<MenuContext | null>(() => {
    try { return JSON.parse(localStorage.getItem("copilot-active-menu") || "null"); } catch { return null; }
  });
  useEffect(() => {
    try { localStorage.setItem("copilot-active-menu", JSON.stringify(activeMenu)); } catch { /* ignore */ }
  }, [activeMenu]);
  const [isListening, setIsListening] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    try {
      const saved = localStorage.getItem("copilot-selected-model") as ModelId | null;
      if (saved === "deepseek-pro" || saved === "deepseek-flash" || saved === "gemini") return saved;
      // legacy migration
      if ((saved as any) === "deepseek") return "deepseek-pro";
    } catch { /* ignore */ }
    return "deepseek-pro";
  });

  // Persist selected model
  useEffect(() => {
    try { localStorage.setItem("copilot-selected-model", selectedModel); } catch { /* ignore */ }
  }, [selectedModel]);
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

  // Mensagem pré-preenchida (ex.: botão Diagnóstico das rotinas automáticas)
  useEffect(() => {
    const pre = sessionStorage.getItem("copilot-prefill");
    if (pre) {
      sessionStorage.removeItem("copilot-prefill");
      setTimeout(() => sendMessage(pre), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stream chat
  const sendMessage = async (text: string, opts?: { menu?: MenuContext | null; prelude?: Message[] }) => {
    if (!text.trim() || isLoading) return;

    const menu = opts && "menu" in opts ? opts.menu ?? null : activeMenu;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, ...(opts?.prelude ?? []), userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-ops-copilot`;
      const resp = await fetch(url, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          messages: newMessages.filter((m) => !m.local).map(({ role, content }) => ({ role, content })),
          model: selectedModel,
          menu: menu ?? undefined,
        }),
      });

      if (!resp.ok) {
        throw new Error(await readError(resp));
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

  // Upload de arquivos: CSV vai para o input; PDF/DOCX/TXT/MD vão para RAG via ingest
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const name = file.name.toLowerCase();
    const isCsv = name.endsWith(".csv");

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const csvText = ev.target?.result as string;
        setInput(`Importar este CSV:\n${csvText.slice(0, 2000)}`);
        toast.success(`CSV "${file.name}" carregado`);
      };
      reader.readAsText(file);
      return;
    }

    // Limite 20MB (mesmo do bucket)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo maior que 20MB. Divida em partes.");
      return;
    }

    const allowed = [".pdf", ".docx", ".txt", ".md", ".markdown"];
    if (!allowed.some((ext) => name.endsWith(ext))) {
      toast.error("Formato não suportado. Use PDF, DOCX, TXT, MD ou CSV.");
      return;
    }

    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `📎 Enviando documento para a RAG: **${file.name}**` },
    ]);

    try {
      const ts = Date.now();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `uploads/${ts}_${safe}`;

      const { error: upErr } = await supabase.storage
        .from("smartdent-method-docs")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("copilot-ingest-method-doc", {
        body: {
          storage_path: path,
          filename: file.name,
          title: file.name.replace(/\.[^.]+$/, ""),
          uploaded_by: userData?.user?.id || null,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);

      const d = data as any;
      const summary = [
        `✅ **Documento indexado na RAG**`,
        `• Título: ${d.title}`,
        `• Tipo: \`${d.doc_type}\``,
        `• Chunks: ${d.chunks}${d.embed_failures ? ` (falhas embed: ${d.embed_failures})` : ""}`,
        d.target_audience?.length ? `• Público: ${d.target_audience.join(", ")}` : "",
        d.target_products?.length ? `• Produtos: ${d.target_products.join(", ")}` : "",
        ``,
        `Já posso usar este conteúdo. Quer que eu gere um rascunho de artigo a partir dele?`,
      ].filter(Boolean).join("\n");
      setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
      toast.success("Documento indexado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao ingerir documento";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${msg}` }]);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Menu do sistema em botões: área → subaba → o que fazer ───
  const openMenu = () => {
    if (isLoading) return;
    setActiveMenu(null);
    setMessages((prev) => [...prev, { role: "assistant", local: true, content: "Em qual área do sistema você quer trabalhar?", menu: { kind: "sections" } }]);
  };

  const newConversation = () => {
    if (isLoading) return;
    setMessages([]);
    setActiveMenu(null);
  };

  const startScreen = (sectionId: string, subtabId: string, prelude: Message[]) => {
    const found = findSection(sectionId);
    const sub = found?.subtabs.find((s) => s.id === subtabId);
    const ctx = buildMenuContext(sectionId, subtabId);
    if (!found || !sub || !ctx) return;
    setActiveMenu(ctx);
    if (sub.actions?.length) {
      setMessages((prev) => [...prev, ...prelude, {
        role: "assistant", local: true,
        content: `O que você quer fazer em **${menuPath(ctx)}**?`,
        menu: { kind: "actions", sectionId, subtabId },
      }]);
      return;
    }
    sendMessage(`Estou em ${menuPath(ctx)}. O que posso fazer aqui com você?`, { menu: ctx, prelude });
  };

  const pickSection = (sectionId: string) => {
    const found = findSection(sectionId);
    if (!found || isLoading) return;
    const title = found.item.title;
    const userPick: Message = { role: "user", local: true, content: `📂 ${title}` };
    if (found.subtabs.length === 1) {
      startScreen(sectionId, found.subtabs[0].id, [userPick]);
      return;
    }
    setActiveMenu(null);
    setMessages((prev) => [...prev, userPick, {
      role: "assistant", local: true,
      content: `Em **${title}**, qual subaba você quer usar?`,
      menu: { kind: "subtabs", sectionId },
    }]);
  };

  const pickSubtab = (sectionId: string, subtabId: string) => {
    const found = findSection(sectionId);
    const sub = found?.subtabs.find((s) => s.id === subtabId);
    if (!found || !sub || isLoading) return;
    startScreen(sectionId, subtabId, [{ role: "user", local: true, content: `📂 ${found.item.title} › ${sub.title}` }]);
  };

  const pickAction = (sectionId: string, subtabId: string, action: CopilotAction) => {
    const ctx = buildMenuContext(sectionId, subtabId, action.guided);
    if (!ctx) return;
    setActiveMenu(ctx);
    sendMessage(action.prompt, { menu: ctx });
  };

  const openScreen = (sectionId: string, subtabId: string) => {
    const sub = findSection(sectionId)?.subtabs.find((s) => s.id === subtabId);
    window.dispatchEvent(new CustomEvent("admin:open-section", { detail: { section: sectionId, sub: sub?.urlSub } }));
  };

  const askFreeText = () => {
    inputRef.current?.focus();
  };

  const renderMenu = (menu: MenuPayload, isLast: boolean) => {
    const disabled = isLoading || !isLast;
    if (menu.kind === "sections") {
      return <div className="mt-2"><CopilotSystemMenu onPick={pickSection} disabled={disabled} /></div>;
    }
    const found = findSection(menu.sectionId);
    if (!found) return null;
    if (menu.kind === "subtabs") {
      return (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {found.subtabs.map((sub) => (
            <Button key={sub.id} size="sm" variant="outline" className="h-8 text-xs" disabled={disabled} onClick={() => pickSubtab(menu.sectionId, sub.id)}>
              {sub.title}
            </Button>
          ))}
        </div>
      );
    }
    const sub = found.subtabs.find((s) => s.id === menu.subtabId);
    if (!sub) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(sub.actions ?? []).map((a) => (
          <Button key={a.label} size="sm" className="h-8 text-xs" disabled={disabled} onClick={() => pickAction(menu.sectionId, menu.subtabId, a)}>
            {a.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={disabled} onClick={askFreeText}>
          <MessageSquarePlus className="w-3.5 h-3.5" /> Outra coisa
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => openScreen(menu.sectionId, menu.subtabId)}>
          <ExternalLink className="w-3.5 h-3.5" /> Abrir a tela
        </Button>
      </div>
    );
  };

  const decideAction = async (action: ActionRef, decision: "confirm" | "cancel") => {
    if (actionStatus[action.id] && actionStatus[action.id] !== "failed") return;
    setActionStatus((prev) => ({ ...prev, [action.id]: "loading" }));
    setMessages((prev) => [...prev, { role: "user", content: decision === "confirm" ? `✅ Confirmar: ${action.title}` : `🚫 Cancelar: ${action.title}` }]);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-ops-copilot`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ confirm_action_id: action.id, decision }),
      });
      if (!resp.ok) throw new Error(await readError(resp));
      const data = await resp.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content || "Sem resposta" }]);
      setActionStatus((prev) => ({ ...prev, [action.id]: data.ok ? (decision === "confirm" ? "done" : "cancelled") : "failed" }));
      if (data.ok && decision === "confirm") toast.success("Gravado com sucesso");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na comunicação";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${msg}` }]);
      setActionStatus((prev) => ({ ...prev, [action.id]: "failed" }));
    }
  };

  const renderActionCard = (action: ActionRef) => {
    const st = actionStatus[action.id];
    return (
      <div key={`action-${action.id}`} className="my-2 rounded-md border border-primary/30 bg-background p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          {action.title}
        </div>
        {st === "done" ? (
          <p className="text-xs text-muted-foreground">Confirmado e gravado.</p>
        ) : st === "cancelled" ? (
          <p className="text-xs text-muted-foreground">Cancelado — nada foi gravado.</p>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decideAction(action, "confirm")} disabled={st === "loading" || isLoading}>
              {st === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Confirmar
            </Button>
            <Button size="sm" variant="outline" onClick={() => decideAction(action, "cancel")} disabled={st === "loading" || isLoading}>
              <X className="w-3 h-3" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderAssistant = (rawText: string, isLast: boolean) => {
    const options: string[] = [];
    OPTIONS_BLOCK_RE.lastIndex = 0;
    const text = rawText
      .replace(OPTIONS_BLOCK_RE, (_all, body) => { options.push(...parseOptions(body)); return ""; })
      .replace(/```copilot-options[\s\S]*$/, "");
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    ACTION_BLOCK_RE.lastIndex = 0;
    while ((m = ACTION_BLOCK_RE.exec(text))) {
      if (m.index > last) parts.push(<div key={`txt-${last}`}>{renderContent(text.slice(last, m.index))}</div>);
      try {
        const a = JSON.parse(m[1]) as ActionRef;
        if (a?.id) parts.push(renderActionCard(a));
      } catch { /* bloco incompleto durante a digitação */ }
      last = m.index + m[0].length;
    }
    const rest = text.slice(last).replace(/```copilot-action[\s\S]*$/, "");
    if (rest.trim()) parts.push(<div key={`txt-${last}`}>{renderContent(rest)}</div>);
    if (options.length) {
      parts.push(
        <div key="options" className="mt-2 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <Button key={o} size="sm" variant="outline" className="h-8 text-xs bg-background" disabled={isLoading || !isLast} onClick={() => sendMessage(o)}>
              {o}
            </Button>
          ))}
        </div>
      );
    }
    return <>{parts}</>;
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
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={openMenu} disabled={isLoading}>
            <LayoutGrid className="w-3.5 h-3.5" /> Menu
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={newConversation} disabled={isLoading || messages.length === 0}>
            <RotateCcw className="w-3.5 h-3.5" /> Nova conversa
          </Button>
        </div>
        <ToggleGroup
          type="single"
          value={selectedModel}
          onValueChange={(v) => { if (v) setSelectedModel(v as ModelId); }}
          size="sm"
        >
          <ToggleGroupItem value="deepseek-pro" className="text-xs gap-1 px-2.5 h-7">
            <Zap className="w-3 h-3" />
            DS V4-Pro
          </ToggleGroupItem>
          <ToggleGroupItem value="deepseek-flash" className="text-xs gap-1 px-2.5 h-7">
            <Rocket className="w-3 h-3" />
            DS V4-Flash
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
                  Escolha uma área do sistema e eu pergunto, passo a passo, o que você quer fazer — ou digite/fale um comando.
                </p>
              </div>
              <div className="w-full max-w-3xl rounded-lg border bg-card p-4">
                <CopilotSystemMenu onPick={pickSection} disabled={isLoading} />
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {CREATION_SUGGESTIONS.map((s) => (
                  <Badge
                    key={s}
                    className="cursor-pointer px-3 py-1.5 text-xs"
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </Badge>
                ))}
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
                    {msg.role === "assistant" ? (
                      <>
                        {renderAssistant(msg.content, i === messages.length - 1)}
                        {msg.menu && renderMenu(msg.menu, i === messages.length - 1)}
                      </>
                    ) : (
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

        {activeMenu && (
          <div className="border-t px-3 pt-2 flex items-center gap-2 text-xs text-muted-foreground bg-card">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span>Trabalhando em <strong className="text-foreground">{menuPath(activeMenu)}</strong></span>
            <button type="button" className="ml-auto hover:text-foreground" onClick={() => setActiveMenu(null)} title="Sair desta área">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {/* Input area */}
        <div className="border-t p-3 flex gap-2 items-center bg-card">
          <input
            type="file"
            accept=".csv,.pdf,.docx,.txt,.md,.markdown"
            ref={fileRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0"
            disabled={isLoading}
            title="Anexar arquivo (PDF, DOCX, TXT, MD, CSV) — vai para a RAG do Copilot"
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

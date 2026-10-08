import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageCircle, ChevronLeft, Smile } from "lucide-react";
import { trackAttendanceEvent } from "@/lib/attendanceChannel";

type Question = { field_id: string | null; form_id: string | null; db_column: string; label: string; options: string[]; field_type?: string };
type Ctx = { form_id: string | null; campaign: string | null; product: string; origin: string; opening: string; greeting?: string; questions: Question[]; product_summary?: string | null; modules_summary?: string | null };
type Msg = { from: "lia" | "user"; text: string; createdAt?: number; question?: Question };
type Seller = { seller_name: string; seller_first_name: string; lead_first_name?: string | null; photo_url: string | null; deal_id: string | null; wa_url: string };
type Step = "phone" | "email" | "name" | "creating" | "qualify" | "done";

const IDLE_MS = 3 * 60 * 1000;

function sellerInvitation(seller: Seller, leadName?: string) {
  const name = seller.seller_first_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const female = ["ana", "maria", "patricia", "luciana", "juliana", "mariana", "carolina", "camila", "fernanda", "gabriela", "amanda", "beatriz", "jessica", "leticia", "bruna", "aline", "daniela", "paula", "renata", "vanessa"].includes(name);
  const male = ["lucas", "danilo", "daniel", "rafael", "fabio", "carlos", "joao", "pedro", "bruno", "marcos", "paulo", "andre", "luiz", "luis", "erick", "felipe", "gustavo", "rodrigo", "leonardo", "eduardo"].includes(name);
  const specialist = female ? "a especialista" : male ? "o especialista" : seller.seller_first_name;
  const contact = female ? "ela" : male ? "ele" : seller.seller_first_name;
  const first = seller.lead_first_name || leadName?.trim().split(/\s+/)[0];
  return `${first ? `${first}, j` : "J"}á passei todas as informações para ${specialist} que vai te chamar. Mas, já que está com o celular na mão, clica aqui no botão abaixo e já chama ${contact} 😄!`;
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("lia-capture", { body });
  if (error) throw error;
  return data;
}

export default function LiaCaptureChat({ formId, campaign, product }: { formId: string | null; campaign: string | null; product: string | null }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const storeKey = `lia_capture_v2_${formId ?? ""}_${campaign ?? ""}_${product ?? ""}`;
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("phone");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [handoffStage, setHandoffStage] = useState(0);
  const mounted = useRef(true);
  const sending = useRef(false);
  const [data, setData] = useState<{ phone?: string; email?: string; name?: string }>({});
  const [lead, setLead] = useState<{ id: string; token: string } | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [closed, setClosed] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const lastActivity = useRef(Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const say = async (text: string, question?: Question) => {
    setTyping(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (!mounted.current) return;
    setMsgs((m) => [...m, { from: "lia", text, question, createdAt: Date.now() }]);
    setTyping(false);
  };
  const echo = (text: string) => setMsgs((m) => [...m, { from: "user", text, createdAt: Date.now() }]);

  useEffect(() => {
    let cancelled = false;
    call({ action: "context", form_id: formId, campaign, product }).then(async (c: Ctx) => {
      if (cancelled) return;
      setCtx(c);
      const saved = sessionStorage.getItem(storeKey);
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (s.lead && s.step === "qualify" && !s.closed) {
            const r = await call({ action: "qualification", lead_id: s.lead.id, token: s.lead.token, form_id: formId, campaign, product });
            if (cancelled) return;
            const questions: Question[] = r.questions;
            setCtx({ ...c, questions });
            const messages: Msg[] = s.msgs ?? [];
            const last = messages[messages.length - 1];
            if (last?.from === "lia" && (c.questions.some((q) => q.label === last.text) || questions.some((q) => q.label === last.text))) messages.pop();
            setData(s.data ?? {}); setLead(s.lead); setQIdx(0);
            if (questions.length) {
              setStep("qualify"); setMsgs([...messages, { from: "lia", text: questions[0].label, question: questions[0], createdAt: Date.now() }]);
            } else {
              setStep("done"); setClosed(true); setMsgs([...messages, { from: "lia", text: "Maravilha! Já tenho as informações para seguir com seu atendimento.", createdAt: Date.now() }]);
            }
            return;
          }
          setMsgs(s.msgs ?? []); setStep(s.step ?? "phone"); setData(s.data ?? {}); setLead(s.lead ?? null); setQIdx(s.qIdx ?? 0); setClosed(!!s.closed);
          return;
        } catch { /* ignore */ }
      }
      setMsgs([{ from: "lia", text: c.greeting || "Olá!", createdAt: Date.now() }]);
      await say(c.opening);
      trackAttendanceEvent({ channel: "whatsapp_lia", event_type: "open", form_id: c.form_id, campaign_slug: c.campaign, product_name: c.product });
    }).catch(() => { if (!cancelled) setMsgs([{ from: "lia", text: "Não consegui iniciar o atendimento agora. Tente novamente em instantes." }]); });
    return () => { cancelled = true; };
  }, [formId, campaign, product, storeKey]);

  useEffect(() => {
    if (!ctx) return;
    sessionStorage.setItem(storeKey, JSON.stringify({ msgs, step, data, lead, qIdx, closed }));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, step, data, lead, qIdx, closed, ctx, storeKey]);

  const finish = async (leadInfo = lead) => {
    if (!leadInfo || closed) return;
    setClosed(true);
    setStep("done");
  };

  // Busca o vendedor designado (lia-assign roda em segundo plano)
  useEffect(() => {
    if (!lead || seller) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await call({ action: "seller", lead_id: lead.id, token: lead.token });
        if (!stop && s?.ready) setSeller(s);
      } catch { /* retry */ }
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [lead, seller]);

  // Inatividade na qualificação com vendedor já designado → encerra
  useEffect(() => {
    if (!lead || closed) return;
    const t = setInterval(() => {
      if (seller && Date.now() - lastActivity.current > IDLE_MS) finish();
    }, 15000);
    return () => clearInterval(t);
  });

  useEffect(() => {
    if (!closed) return;
    const first = setTimeout(() => setHandoffStage(1), 700);
    const second = setTimeout(() => setHandoffStage(2), 1400);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [closed]);

  useEffect(() => {
    if (!closed || !seller || handoffStage !== 2) return;
    const timer = setTimeout(() => setHandoffStage(3), 700);
    return () => clearTimeout(timer);
  }, [closed, seller, handoffStage]);

  useEffect(() => {
    if (!busy && !closed) inputRef.current?.focus();
  }, [busy, closed, step, ctx]);

  const register = async (identity: typeof data, firstName?: string | null) => {
    if (!ctx) return;
    const r = await call({
      action: "create", form_id: ctx.form_id, campaign: ctx.campaign, product: ctx.product,
      name: identity.name, email: identity.email, phone: identity.phone,
      session_id: sessionStorage.getItem("dra_lia_session"),
      utm_source: params.get("utm_source"), utm_medium: params.get("utm_medium"), utm_campaign: params.get("utm_campaign"),
    });
    setLead({ id: r.lead_id, token: r.token });
    if (firstName) setData({ ...identity, name: firstName });
    await say(firstName ? `Maravilha, ${firstName}!` : "Maravilha!");
    const questions: Question[] = r.questions;
    setCtx({ ...ctx, questions });
    setQIdx(0);
    if (questions.length) {
      setStep("qualify"); await say(questions[0].label, questions[0]);
    } else {
      await say("Já tenho as informações para seguir com seu atendimento.");
      await finish({ id: r.lead_id, token: r.token });
    }
  };

  const submit = async (raw: string | string[]) => {
    const text = Array.isArray(raw) ? raw.join(", ") : raw.trim();
    if (!text || busy || typing || sending.current || !ctx || closed) return;
    sending.current = true;
    lastActivity.current = Date.now();
    setInput("");
    echo(text);
    setBusy(true);
    try {
      if (step === "phone") {
        const digits = text.replace(/\D/g, "");
        if (digits.length < 10) { await say("Esse número parece incompleto. Pode enviar com DDD? Ex.: 16 99999-9999"); return; }
        const r = await call({ action: "lookup", phone: digits });
        const identity = { ...data, phone: digits };
        setData(identity);
        if (r?.found && r.has_email && r.has_name) await register(identity, r.first_name);
        else {
          setStep("email");
          if (r?.ambiguous) {
            const hints = Array.isArray(r.email_hints) ? r.email_hints.filter((hint: unknown): hint is string => typeof hint === "string") : [];
            await say(`${r.first_name ? `${r.first_name}, identifiquei` : "Identifiquei"} ${r.match_count ?? "vários"} cadastros com esse telefone.${hints.length ? `\n\n${hints.join("\n")}\n\nQual destes e-mails é o correto? Me escreva o e-mail completo para confirmar.` : " Qual é o seu e-mail para eu confirmar o cadastro correto?"}`);
          } else {
            if (r?.first_name) await say(`Maravilha, ${r.first_name}!`);
            await say("Me passa seu melhor e-mail para eu continuar por aqui?");
          }
        }
      } else if (step === "email") {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) { await say("Esse e-mail não parece válido. Pode conferir?"); return; }
        const identity = { ...data, email: text.toLowerCase() };
        const r = await call({ action: "lookup", phone: identity.phone, email: identity.email });
        setData(identity);
        if (r?.found && r.has_name) await register(identity, r.first_name);
        else { setStep("name"); await say("E como você se chama?"); }
      } else if (step === "name") {
        if (text.length < 2) { await say("Pode me dizer seu nome?"); return; }
        const full = { ...data, name: text };
        setData(full);
        await register(full, text.split(" ")[0]);
      } else if (step === "qualify" && lead) {
        const q = ctx.questions[qIdx];
        if (!q) return;
        const r = await call({ action: "answer", lead_id: lead.id, token: lead.token, db_column: q.db_column, field_id: q.field_id, form_id: q.form_id, form_id_context: ctx.form_id, campaign: ctx.campaign, product: ctx.product, value: Array.isArray(raw) ? raw : text });
        setSelected([]);
        const questions: Question[] = r.questions;
        setCtx({ ...ctx, questions });
        setQIdx(0);
        if (questions.length) await say(questions[0].label, questions[0]); else await finish();
      }
    } catch {
      await say("Tive um problema para registrar. Pode tentar de novo?");
      if (step === "creating") setStep("name");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const q = step === "qualify" ? ctx?.questions[qIdx] : undefined;
  const showSeller = seller && closed && handoffStage >= 3;
  const waiting = busy || typing;

  return (
    <div className="lia-whatsapp flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-3">
        <Button variant="ghost" size="icon" className="lia-icon-button h-8 w-7 shrink-0 text-accent" aria-label="Voltar" title="Voltar" onClick={() => window.history.back()}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden="true">LIA</div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Dra. LIA</p>
          <p className="truncate text-xs text-muted-foreground">{waiting ? "digitando…" : "Smart Dent | Fluxo Digital"}</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" role="log" aria-label="Conversa com a Dra. LIA" aria-live="polite">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="mb-3 self-center rounded-md bg-card px-3 py-1 text-[11px] text-muted-foreground">Hoje</div>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`lia-bubble max-w-[88%] rounded-lg px-3 pb-1 pt-2 text-[15px] leading-5 sm:max-w-[78%] ${m.from === "user" ? "lia-bubble-out rounded-tr-none bg-primary text-primary-foreground" : "lia-bubble-in rounded-tl-none bg-muted text-foreground"}`}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.from === "lia" && (m.question || (i === msgs.length - 1 && q?.label === m.text ? q : null))?.options.map((option) => (
                <Button key={option} size="sm" variant="secondary" className="lia-reply mt-2 h-auto min-h-9 w-full whitespace-normal rounded-md text-left text-xs" disabled={waiting || closed || i !== msgs.length - 1} aria-pressed={m.question?.field_type === "checkbox" ? selected.includes(option) : undefined} onClick={() => {
                  if (m.question?.field_type === "checkbox") setSelected((items) => items.includes(option) ? items.filter((item) => item !== option) : [...items, option]);
                  else submit(option);
                }}>{m.question?.field_type === "checkbox" && selected.includes(option) ? "✓ " : ""}{option.trim()}</Button>
              ))}
              {m.question?.field_type === "checkbox" && i === msgs.length - 1 && !closed && <Button variant="secondary" size="sm" className="mt-2 w-full" disabled={waiting || !selected.length} onClick={() => submit(selected)}>Confirmar</Button>}
              {m.createdAt && <time dateTime={new Date(m.createdAt).toISOString()} className="ml-4 mt-1 flex items-center justify-end gap-1 text-[10px] leading-3 text-muted-foreground">
                {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </time>}
            </div>
          </div>
        ))}
        {closed && handoffStage >= 1 && ctx?.product_summary && (
          <div className="flex justify-start">
            <div className="lia-bubble lia-bubble-in max-w-[88%] whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-muted px-3 py-2 text-[15px] leading-5 text-foreground sm:max-w-[78%]">{ctx.product_summary}</div>
          </div>
        )}
        {closed && handoffStage >= 2 && ctx?.modules_summary && (
          <div className="flex justify-start">
            <div className="lia-bubble lia-bubble-in max-w-[88%] whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-muted px-3 py-2 text-[15px] leading-5 text-foreground sm:max-w-[78%]">{ctx.modules_summary}</div>
          </div>
        )}
        {showSeller && (
          <div className="flex justify-start">
            <div className="lia-bubble lia-bubble-in max-w-[88%] rounded-lg rounded-tl-none bg-muted px-3 py-2 text-[15px] leading-5 text-foreground sm:max-w-[78%]">
              {sellerInvitation(seller, data.name)}
            </div>
          </div>
        )}
        {(waiting || (closed && !showSeller)) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {closed && handoffStage >= 2 && !seller ? "Localizando seu especialista…" : "Digitando…"}</div>
        )}
        {showSeller && (
          <div className="mt-3 flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-card p-4 text-center">
            {seller.photo_url ? (
              <img src={seller.photo_url} alt={seller.seller_name} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                {seller.seller_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{seller.seller_name}</p>
              <p className="text-xs text-muted-foreground">Especialista de produto{seller.deal_id ? ` · Atendimento nº ${seller.deal_id}` : ""}</p>
            </div>
            <Button asChild variant="secondary" className="lia-send w-full">
              <a href={seller.wa_url} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" /> Me chame agora no WhatsApp</a>
            </Button>
          </div>
        )}
        <div ref={endRef} />
        </div>
      </div>
      {!closed && (
        <div className="shrink-0 border-t border-border bg-card px-3 pb-3 pt-2">
          <div className="mx-auto max-w-3xl">
             {emojiOpen && <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-secondary p-2" aria-label="Emojis">
               {["😊", "👍", "👋", "🙏", "✅", "🦷"].map((emoji) => <Button key={emoji} variant="ghost" size="icon" aria-label={`Inserir ${emoji}`} onClick={() => { setInput((v) => v + emoji); setEmojiOpen(false); inputRef.current?.focus(); }}>{emoji}</Button>)}
             </div>}
             <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setEmojiOpen(false); submit(input); }}>
               <Button type="button" variant="ghost" size="icon" className="lia-icon-button shrink-0 rounded-full text-muted-foreground" aria-label="Emojis" title="Emojis" onClick={() => setEmojiOpen((v) => !v)}><Smile className="h-5 w-5" /></Button>
               <Input ref={inputRef} className="h-10 min-w-0 rounded-full border-0 bg-secondary px-4 text-[15px] shadow-none focus-visible:ring-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mensagem" disabled={waiting || step === "creating" || !ctx}
                inputMode={step === "phone" ? "tel" : step === "email" ? "email" : "text"} />
               <Button type="submit" variant="secondary" className="lia-send shrink-0 rounded-full" size="icon" aria-label="Enviar mensagem" disabled={waiting || !ctx || !input.trim()}><Send className="h-5 w-5" /></Button>
            </form>
           </div>
        </div>
      )}
    </div>
  );
}

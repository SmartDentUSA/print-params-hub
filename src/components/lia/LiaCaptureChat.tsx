import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageCircle, ChevronLeft, Smile, Check } from "lucide-react";
import { trackAttendanceEvent } from "@/lib/attendanceChannel";

type Question = { field_id: string | null; form_id: string | null; db_column: string; label: string; options: string[] };
type Ctx = { form_id: string | null; campaign: string | null; product: string; origin: string; opening: string; questions: Question[] };
type Msg = { from: "lia" | "user"; text: string; createdAt?: number };
type Seller = { seller_name: string; seller_first_name: string; photo_url: string | null; deal_id: string | null; wa_url: string };
type Step = "phone" | "email" | "name" | "creating" | "qualify" | "done";

const IDLE_MS = 3 * 60 * 1000;

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
  const [data, setData] = useState<{ phone?: string; email?: string; name?: string }>({});
  const [lead, setLead] = useState<{ id: string; token: string } | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [closed, setClosed] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const lastActivity = useRef(Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const say = (text: string) => setMsgs((m) => [...m, { from: "lia", text, createdAt: Date.now() }]);
  const echo = (text: string) => setMsgs((m) => [...m, { from: "user", text, createdAt: Date.now() }]);

  useEffect(() => {
    call({ action: "context", form_id: formId, campaign, product }).then((c: Ctx) => {
      setCtx(c);
      const saved = sessionStorage.getItem(storeKey);
      if (saved) {
        try {
          const s = JSON.parse(saved);
          setMsgs(s.msgs ?? []); setStep(s.step ?? "phone"); setData(s.data ?? {}); setLead(s.lead ?? null); setQIdx(s.qIdx ?? 0); setClosed(!!s.closed);
          return;
        } catch { /* ignore */ }
      }
      setMsgs([{ from: "lia", text: "Olá!", createdAt: Date.now() }, { from: "lia", text: c.opening, createdAt: Date.now() }]);
      trackAttendanceEvent({ channel: "whatsapp_lia", event_type: "open", form_id: c.form_id, campaign_slug: c.campaign, product_name: c.product });
    }).catch(() => setMsgs([{ from: "lia", text: "Não consegui iniciar o atendimento agora. Tente novamente em instantes." }]));
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
    say("Acabei de designar um especialista de produto para te atender e, com as informações que você me passou, ele não tomará seu tempo.");
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

  const askQuestion = (i: number) => {
    const q = ctx?.questions[i];
    if (q) say(q.label);
  };

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
    say(firstName ? `Maravilha, ${firstName}!` : "Maravilha!");
    setStep("qualify"); setQIdx(0); askQuestion(0);
  };

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || !ctx) return;
    lastActivity.current = Date.now();
    setInput("");
    echo(text);
    setBusy(true);
    try {
      if (step === "phone") {
        const digits = text.replace(/\D/g, "");
        if (digits.length < 10) { say("Esse número parece incompleto. Pode enviar com DDD? Ex.: 16 99999-9999"); return; }
        const r = await call({ action: "lookup", phone: digits });
        const identity = { ...data, phone: digits };
        setData(identity);
        if (r?.found && r.has_email && r.has_name) await register(identity, r.first_name);
        else {
          if (r?.first_name) say(`Maravilha, ${r.first_name}!`);
          setStep("email");
          say("Me passa seu melhor e-mail para eu continuar por aqui?");
        }
      } else if (step === "email") {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) { say("Esse e-mail não parece válido. Pode conferir?"); return; }
        const identity = { ...data, email: text.toLowerCase() };
        const r = await call({ action: "lookup", phone: identity.phone, email: identity.email });
        setData(identity);
        if (r?.found && r.has_name) await register(identity, r.first_name);
        else { setStep("name"); say("E como você se chama?"); }
      } else if (step === "name") {
        if (text.length < 2) { say("Pode me dizer seu nome?"); return; }
        const full = { ...data, name: text };
        setData(full);
        await register(full, text.split(" ")[0]);
      } else if (step === "qualify" && lead) {
        const q = ctx.questions[qIdx];
        if (q) await call({ action: "answer", lead_id: lead.id, token: lead.token, db_column: q.db_column, field_id: q.field_id, form_id: q.form_id, value: text });
        const next = qIdx + 1;
        if (next < ctx.questions.length) { setQIdx(next); askQuestion(next); } else finish();
      }
    } catch {
      say("Tive um problema para registrar. Pode tentar de novo?");
      if (step === "creating") setStep("name");
    } finally {
      setBusy(false);
    }
  };

  const q = step === "qualify" ? ctx?.questions[qIdx] : undefined;
  const showSeller = seller && (closed || step === "done");

  return (
    <div className="lia-whatsapp flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-3">
        <Button variant="ghost" size="icon" className="lia-icon-button h-8 w-7 shrink-0 text-accent" aria-label="Voltar" title="Voltar" onClick={() => window.history.back()}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden="true">LIA</div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Dra. LIA</p>
          <p className="truncate text-xs text-muted-foreground">{busy ? "digitando…" : "Smart Dent | Fluxo Digital"}</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" role="log" aria-label="Conversa com a Dra. LIA" aria-live="polite">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="mb-3 self-center rounded-md bg-card px-3 py-1 text-[11px] text-muted-foreground">Hoje</div>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`lia-bubble max-w-[88%] rounded-lg px-3 pb-1 pt-2 text-[15px] leading-5 sm:max-w-[78%] ${m.from === "user" ? "lia-bubble-out rounded-tr-none bg-primary text-primary-foreground" : "lia-bubble-in rounded-tl-none bg-muted text-foreground"}`}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.createdAt && <time dateTime={new Date(m.createdAt).toISOString()} className="ml-4 mt-1 flex items-center justify-end gap-1 text-[10px] leading-3 text-muted-foreground">
                {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </time>}
            </div>
          </div>
        ))}
        {(busy || (closed && !seller)) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {closed ? "Localizando seu especialista…" : "Digitando…"}</div>
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
          {q && q.options.length > 0 && q.options.length <= 10 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {q.options.map((o) => (
                <Button key={o} size="sm" variant="secondary" className="lia-reply h-auto min-h-9 max-w-full whitespace-normal rounded-lg text-left text-xs" disabled={busy} onClick={() => submit(o)}>{o.trim()}</Button>
              ))}
            </div>
          ) : q && q.options.length > 10 ? (
            <select className="w-full rounded-md border border-input bg-background p-2 text-sm" defaultValue="" disabled={busy} onChange={(e) => e.target.value && submit(e.target.value)}>
              <option value="" disabled>Selecione…</option>
              {q.options.map((o) => <option key={o} value={o}>{o.trim()}</option>)}
            </select>
           ) : null}
             {emojiOpen && <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-secondary p-2" aria-label="Emojis">
               {["😊", "👍", "👋", "🙏", "✅", "🦷"].map((emoji) => <Button key={emoji} variant="ghost" size="icon" aria-label={`Inserir ${emoji}`} onClick={() => { setInput((v) => v + emoji); setEmojiOpen(false); inputRef.current?.focus(); }}>{emoji}</Button>)}
             </div>}
             <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setEmojiOpen(false); submit(input); }}>
               <Button type="button" variant="ghost" size="icon" className="lia-icon-button shrink-0 rounded-full text-muted-foreground" aria-label="Emojis" title="Emojis" onClick={() => setEmojiOpen((v) => !v)}><Smile className="h-5 w-5" /></Button>
               <Input ref={inputRef} className="h-10 min-w-0 rounded-full border-0 bg-secondary px-4 text-[15px] shadow-none focus-visible:ring-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mensagem" disabled={busy || step === "creating" || !ctx}
                inputMode={step === "phone" ? "tel" : step === "email" ? "email" : "text"} />
               <Button type="submit" variant="secondary" className="lia-send shrink-0 rounded-full" size="icon" aria-label="Enviar mensagem" disabled={busy || !input.trim()}><Send className="h-5 w-5" /></Button>
            </form>
           </div>
        </div>
      )}
    </div>
  );
}

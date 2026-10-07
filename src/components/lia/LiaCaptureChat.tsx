import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { trackAttendanceEvent } from "@/lib/attendanceChannel";

type Question = { field_id: string; form_id: string; db_column: string; label: string; options: string[] };
type Ctx = { form_id: string | null; campaign: string | null; product: string; origin: string; opening: string; questions: Question[] };
type Msg = { from: "lia" | "user"; text: string };
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
  const storeKey = `lia_capture_${formId ?? ""}_${campaign ?? ""}_${product ?? ""}`;
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
  const lastActivity = useRef(Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  const say = (text: string) => setMsgs((m) => [...m, { from: "lia", text }]);
  const echo = (text: string) => setMsgs((m) => [...m, { from: "user", text }]);

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
      setMsgs([{ from: "lia", text: c.opening }, { from: "lia", text: "Para começar, qual é o seu WhatsApp com DDD?" }]);
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
        setData((d) => ({ ...d, phone: digits }));
        if (r?.found && r.first_name) say(`Que bom te ver por aqui, ${r.first_name}!`);
        setStep("email");
        say("Qual é o seu melhor e-mail?");
      } else if (step === "email") {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) { say("Esse e-mail não parece válido. Pode conferir?"); return; }
        setData((d) => ({ ...d, email: text.toLowerCase() }));
        setStep("name");
        say("E qual é o seu nome completo?");
      } else if (step === "name") {
        if (text.length < 2) { say("Pode me dizer seu nome?"); return; }
        const full = { ...data, name: text };
        setData(full);
        setStep("creating");
        const r = await call({
          action: "create", form_id: ctx.form_id, campaign: ctx.campaign, product: ctx.product,
          name: full.name, email: full.email, phone: full.phone, session_id: sessionStorage.getItem("dra_lia_session"),
          utm_source: params.get("utm_source"), utm_medium: params.get("utm_medium"), utm_campaign: params.get("utm_campaign"),
        });
        const info = { id: r.lead_id, token: r.token };
        setLead(info);
        const first = text.split(" ")[0];
        say(`Obrigada, ${first}! Seu atendimento já está registrado.`);
        if (ctx.questions.length > 0) {
          say("Para o especialista não tomar seu tempo, me conta rapidinho:");
          setStep("qualify"); setQIdx(0); askQuestion(0);
        } else {
          finish(info);
        }
      } else if (step === "qualify" && lead) {
        const q = ctx.questions[qIdx];
        if (q) call({ action: "answer", lead_id: lead.id, token: lead.token, db_column: q.db_column, field_id: q.field_id, form_id: q.form_id, value: text }).catch(() => {});
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
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        <MessageCircle className="h-5 w-5" />
        <div>
          <p className="text-sm font-semibold">Dra. LIA · Smart Dent</p>
          <p className="text-xs opacity-80">{ctx?.product || "Atendimento"}</p>
        </div>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{m.text}</div>
          </div>
        ))}
        {(busy || (closed && !seller)) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {closed ? "Localizando seu especialista…" : "Digitando…"}</div>
        )}
        {showSeller && (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center">
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
            <Button asChild className="w-full">
              <a href={seller.wa_url} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" /> Me chame agora no WhatsApp</a>
            </Button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {!closed && (
        <div className="border-t border-border p-3">
          {q && q.options.length > 0 && q.options.length <= 10 ? (
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => (
                <Button key={o} size="sm" variant="outline" disabled={busy} onClick={() => submit(o)}>{o.trim()}</Button>
              ))}
            </div>
          ) : q && q.options.length > 10 ? (
            <select className="w-full rounded-md border border-input bg-background p-2 text-sm" defaultValue="" disabled={busy} onChange={(e) => e.target.value && submit(e.target.value)}>
              <option value="" disabled>Selecione…</option>
              {q.options.map((o) => <option key={o} value={o}>{o.trim()}</option>)}
            </select>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua resposta…" disabled={busy || step === "creating" || !ctx}
                inputMode={step === "phone" ? "tel" : step === "email" ? "email" : "text"} />
              <Button type="submit" size="icon" disabled={busy || !input.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

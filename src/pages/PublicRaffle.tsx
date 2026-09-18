import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Check, Trophy } from "lucide-react";
import type { RaffleField, RafflePrize } from "@/components/smartops/events/EventRafflesPanel";

type PublicRaffleData = {
  id: string;
  name: string;
  slug: string;
  starts_at: string | null;
  ends_at: string | null;
  rules_text: string | null;
  prizes: RafflePrize[];
  form_fields: RaffleField[];
  eligibility: Record<string, any>;
  cover_image_url: string | null;
  public_results: boolean;
  event: { name: string; location: string | null; company_stand: string | null };
  winners: { prize: string; name: string; drawn_at: string }[];
  consultants: { id: string; name: string }[];
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : "";

export default function PublicRaffle() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicRaffleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, any>>({});
  const [consultant, setConsultant] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: res } = await (supabase as any).rpc("fn_public_raffle", { p_slug: slug });
      setData(res || null);
      setLoading(false);
    })();
  }, [slug]);

  const requireConsultant = !!data?.eligibility?.require_stand_visit;
  const requireConsent = data?.eligibility?.require_consent !== false;

  const period = useMemo(() => {
    if (!data?.starts_at && !data?.ends_at) return "";
    return `${fmtDate(data?.starts_at ?? null)}${data?.ends_at ? ` até ${fmtDate(data.ends_at)}` : ""}`;
  }, [data]);

  async function submit() {
    if (!data) return;
    for (const f of data.form_fields) {
      if (f.required && !String(values[f.key] ?? "").trim()) {
        return toast.error(`Preencha: ${f.label}`);
      }
    }
    if (requireConsent && !consent) return toast.error("Aceite as regras do sorteio para participar");
    if (requireConsultant && !consultant) return toast.error("Selecione o consultor que te atendeu");

    setSending(true);
    const { data: res, error } = await (supabase as any).functions.invoke("smart-ops-raffle-entry", {
      body: {
        slug,
        name: values.nome,
        email: values.email,
        phone: values.telefone,
        answers: values,
        consent,
        seller_team_member_id: consultant || null,
      },
    });
    setSending(false);
    if (error || res?.ok === false) {
      return toast.error("Não foi possível concluir seu cadastro", { description: res?.error || error?.message });
    }
    setDone(true);
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando...</div>;
  if (!data) return <div className="min-h-screen grid place-items-center text-muted-foreground">Sorteio não encontrado ou encerrado.</div>;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="text-center space-y-2">
          <Badge variant="secondary" className="mx-auto"><Gift className="w-3 h-3 mr-1" /> Sorteio</Badge>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.event.name}
            {data.event.company_stand ? ` · Estande ${data.event.company_stand}` : ""}
            {period ? ` · ${period}` : ""}
          </p>
        </header>

        {data.prizes.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Prêmios</h2>
              <div className="grid gap-2">
                {data.prizes.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 border rounded-md p-2">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} loading="lazy" className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted grid place-items-center"><Gift className="w-6 h-6 text-muted-foreground" /></div>
                    )}
                    <div>
                      <div className="font-medium text-sm">{p.title}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                      {(p.quantity ?? 1) > 1 && <div className="text-xs text-muted-foreground">{p.quantity} unidades</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {done ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <Check className="w-8 h-8 mx-auto text-primary" />
              <h2 className="font-semibold">Você está participando!</h2>
              <p className="text-sm text-muted-foreground">
                Boa sorte. Se você for sorteado, avisamos pelo WhatsApp informado no cadastro.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Participe</h2>
              {data.form_fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label>{f.label}{f.required ? " *" : ""}</Label>
                  {f.type === "textarea" ? (
                    <Textarea value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                  ) : f.type === "select" || f.type === "radio" ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(f.options || []).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setValues({ ...values, [f.key]: o })}
                          className={`rounded-md border p-2 text-sm text-left ${values[f.key] === o ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"}`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  ) : f.type === "checkbox" ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(f.options || []).map((o) => {
                        const arr: string[] = Array.isArray(values[f.key]) ? values[f.key] : [];
                        const on = arr.includes(o);
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setValues({ ...values, [f.key]: on ? arr.filter((x) => x !== o) : [...arr, o] })}
                            className={`rounded-md border p-2 text-sm text-left ${on ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"}`}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                      value={values[f.key] || ""}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}

              {data.consultants.length > 0 && (
                <div className="space-y-1">
                  <Label>Consultor que te atendeu{requireConsultant ? " *" : ""}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {data.consultants.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setConsultant(consultant === c.id ? "" : c.id)}
                        className={`rounded-md border p-2 text-sm text-left ${consultant === c.id ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {data.rules_text && (
                <div className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-line text-muted-foreground">
                  {data.rules_text}
                </div>
              )}

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                <span>Li e aceito as regras do sorteio e autorizo o contato da Smart Dent.</span>
              </label>

              <Button className="w-full" onClick={submit} disabled={sending}>
                {sending ? "Enviando..." : "Quero participar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {data.public_results && data.winners.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-1"><Trophy className="w-4 h-4" /> Ganhadores</h2>
              {data.winners.map((w, i) => (
                <div key={i} className="text-sm flex justify-between border-b last:border-0 py-1">
                  <span>{w.prize}</span>
                  <strong>{w.name}</strong>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

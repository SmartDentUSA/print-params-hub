import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, CheckCircle2, Heart } from "lucide-react";

const GOOGLE_REVIEW_URL = "https://share.google/f43QoVKwzoSBK3TaC";

type Phase = "form" | "google" | "recover" | "done" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  token_invalido: "Este link de avaliação não é válido.",
  token_expirado: "Este link de avaliação expirou.",
  token_ja_utilizado: "Esse link já foi utilizado. Obrigado pela sua resposta!",
};

export default function PublicNps() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [satisf, setSatisf] = useState(0);
  const [train, setTrain] = useState(0);
  const [rec, setRec] = useState(0);
  const [comment, setComment] = useState("");
  const [recoverText, setRecoverText] = useState("");
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit() {
    if (!token) return;
    if (!satisf || !train || !rec) {
      toast({ title: "Responda as 3 perguntas", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("cs-nps-responder", {
        body: {
          token,
          score_satisfacao: satisf,
          score_treinamentos: train,
          score_recomendacao: rec,
          comment: comment || undefined,
        },
      });
      if (error) {
        let code = "";
        try {
          const ctx = (error as any).context;
          const body = ctx ? await ctx.json() : null;
          code = body?.error ?? "";
        } catch { /* ignore */ }
        setErrorMsg(ERROR_MESSAGES[code] ?? "Não foi possível registrar sua avaliação. Tente novamente mais tarde.");
        setPhase("error");
        return;
      }
      const res = data as { show_google_invite: boolean };
      setPhase(res?.show_google_invite ? "google" : "recover");
    } catch {
      setErrorMsg("Não foi possível registrar sua avaliação. Tente novamente mais tarde.");
      setPhase("error");
    } finally {
      setSending(false);
    }
  }

  async function sendRecover() {
    if (!token || !recoverText.trim()) {
      setPhase("done");
      return;
    }
    setSending(true);
    try {
      await supabase.functions.invoke("cs-nps-responder", {
        body: { token, follow_up_comment: recoverText.trim() },
      });
      setPhase("done");
    } catch {
      setPhase("done");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Smart Dent</p>
            <CardTitle className="text-2xl">
              {phase === "form" ? "Sua opinião sincera" : "Obrigado!"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {phase === "form" && (
              <>
                <NpsQuestion
                  label="Até o momento, qual o nível de satisfação com a Smart Dent?"
                  value={satisf}
                  onChange={setSatisf}
                />
                <NpsQuestion
                  label="Como você classifica a qualidade dos treinamentos recebidos até o momento?"
                  value={train}
                  onChange={setTrain}
                />
                <NpsQuestion
                  label="Qual a probabilidade de você recomendar a Smart Dent para um colega?"
                  value={rec}
                  onChange={setRec}
                />
                <div className="space-y-2 border-t border-border pt-4">
                  <Label htmlFor="comment">Comentário (opcional)</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Conte o que achou..."
                  />
                </div>
                <Button className="w-full" disabled={sending} onClick={submit}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enviar
                </Button>
              </>
            )}

            {phase === "google" && (
              <div className="text-center py-4 space-y-4">
                <Heart className="w-14 h-14 text-primary mx-auto" />
                <h3 className="text-xl font-semibold">Que bom que você gostou!</h3>
                <p className="text-sm text-muted-foreground">
                  Caso queira nos ajudar a melhorar cada vez mais, queremos saber sua opinião.
                </p>
                <Button asChild className="w-full">
                  <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                    Deixar minha avaliação
                  </a>
                </Button>
              </div>
            )}

            {phase === "recover" && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">Sentimos muito</h3>
                  <p className="text-sm text-muted-foreground">
                    Conte pra gente o que aconteceu — vamos usar isso para melhorar.
                  </p>
                </div>
                <Textarea
                  value={recoverText}
                  onChange={(e) => setRecoverText(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="O que podemos fazer melhor?"
                />
                <Button className="w-full" disabled={sending} onClick={sendRecover}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enviar
                </Button>
              </div>
            )}

            {phase === "done" && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                <h3 className="text-xl font-semibold">Obrigado pelo seu retorno!</h3>
                <p className="text-sm text-muted-foreground">
                  Nosso time de Customer Success vai analisar sua resposta.
                </p>
              </div>
            )}

            {phase === "error" && (
              <div className="text-center py-6 space-y-3">
                <h3 className="text-xl font-semibold">Avaliação indisponível</h3>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NpsQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <p className="text-sm text-center">{label}</p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1 transition-transform hover:scale-110"
            aria-label={`${n} estrelas`}
          >
            <Star className={`w-8 h-8 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
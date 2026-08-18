import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function formatPhone(v: string) {
  const d = v.replace(/\D+/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function ClientLogin() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/base-conhecimento?tab=parametros";

  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  const [loadingToken, setLoadingToken] = useState(Boolean(token));
  const [invite, setInvite] = useState<{ nome: string | null; phone_masked: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("client-access-login", {
        body: { action: "lookup", token },
      });
      if (error || !data?.ok) setTokenError(data?.error || "Link inválido ou expirado.");
      else setInvite({ nome: data.nome ?? null, phone_masked: data.phone_masked });
      setLoadingToken(false);
    })();
  }, [token]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-access-login", {
        body: { action: "direct", phone },
      });
      if (error || !data?.ok) {
        throw new Error(data?.error || "Não encontramos este celular na nossa base de clientes.");
      }
      const { error: eSess } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: data.token_hash as string,
      });
      if (eSess) throw eSess;
      const primeiro = String(data.nome ?? "").trim().split(/\s+/)[0];
      toast({ title: `Bem-vindo(a)${primeiro ? `, ${primeiro}` : ""}!`, description: "Acesso liberado." });
      navigate(nextPath, { replace: true });
    } catch (err) {
      toast({ title: "Acesso não liberado", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const confirmPhone = async () => {
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-access-login", {
        body: { action: "confirm", token },
      });
      if (error || !data?.ok) throw new Error(data?.error || "Não foi possível confirmar.");
      const { error: eSess } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: data.token_hash as string,
      });
      if (eSess) throw eSess;
      toast({ title: "Acesso confirmado!", description: "Bem-vindo(a) à Smart Dent." });
      navigate(nextPath, { replace: true });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {token ? "Confirmar acesso" : "Entrar com seu celular"}
          </CardTitle>
          <CardDescription>
            {token
              ? "Confirme que este número é seu para acessar sua área."
              : "Sem senha: informe o celular cadastrado e entre direto."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            loadingToken ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Validando link...
              </div>
            ) : tokenError ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-destructive">{tokenError}</p>
                <Button variant="outline" className="w-full" onClick={() => navigate("/entrar", { replace: true })}>
                  Solicitar novo acesso
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-center space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Olá{invite?.nome ? `, ${invite.nome.split(" ")[0]}` : ""}
                  </p>
                  <p className="text-lg font-semibold text-foreground">{invite?.phone_masked}</p>
                </div>
                <Button className="w-full" onClick={confirmPhone} disabled={confirming}>
                  {confirming ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirmando...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar celular</>
                  )}
                </Button>
              </div>
            )
          ) : (
            <form onSubmit={entrar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-phone">Celular com DDD</Label>
                <Input
                  id="client-phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="(11) 91234-5678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={sending || phone.replace(/\D+/g, "").length < 10}>
                {sending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</>) : "Entrar"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Use o celular cadastrado na Smart Dent.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

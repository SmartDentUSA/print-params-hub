import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, ShieldCheck } from "lucide-react";

const AUTH_URL = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/kol-portal-auth";
const SMARTDENT_LOGO_URL =
  "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png";

interface Props {
  onSession: (sessionToken: string) => void;
}

/** Login do Portal do Profissional Parceiro: celular cadastrado → código de 6 dígitos via WhatsApp. */
export default function PortalPhoneLogin({ onSession }: Props) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`);
    return json;
  };

  const requestCode = async () => {
    setError(null);
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Informe o celular com DDD.");
      return;
    }
    setLoading(true);
    try {
      await post({ action: "request_otp", phone });
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (code.replace(/\D/g, "").length !== 6) {
      setError("Informe o código de 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const data = await post({ action: "verify_otp", phone, code });
      if (!data?.session_token) throw new Error("Sessão não criada. Tente novamente.");
      sessionStorage.setItem("kol_portal_session", data.session_token);
      onSession(data.session_token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src={SMARTDENT_LOGO_URL} alt="Smart Dent" className="h-10 mb-2" />
          <CardTitle className="text-lg">Portal do Profissional Parceiro</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === "phone"
              ? "Entre com o celular cadastrado na parceria."
              : "Enviamos um código de 6 dígitos no seu WhatsApp."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "phone" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="portal-phone">Celular com DDD</Label>
                <Input
                  id="portal-phone"
                  inputMode="tel"
                  placeholder="(16) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void requestCode()}
                />
              </div>
              <Button className="w-full" onClick={() => void requestCode()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                Receber código no WhatsApp
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="portal-code">Código de acesso</Label>
                <Input
                  id="portal-code"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void verifyCode()}
                />
              </div>
              <Button className="w-full" onClick={() => void verifyCode()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Entrar no portal
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setStep("phone"); setCode(""); }}>
                Trocar celular
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

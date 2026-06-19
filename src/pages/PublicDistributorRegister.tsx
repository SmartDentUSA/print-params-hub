import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Building2 } from "lucide-react";
import { DistributorForm, emptyDistributorForm, DistributorFormValue } from "@/components/smartops/DistributorForm";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function PublicDistributorRegister() {
  const [form, setForm] = useState<DistributorFormValue>(emptyDistributorForm());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Cadastro de Distribuidor Credenciado | SmartDent";
    const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute(
      "content",
      "Cadastre sua empresa como distribuidor credenciado SmartDent. Formulário oficial para representantes e revendas."
    );
    if (!meta.parentNode) document.head.appendChild(meta);
    const robots = document.querySelector('meta[name="robots"]') || document.createElement("meta");
    robots.setAttribute("name", "robots");
    robots.setAttribute("content", "noindex,nofollow");
    if (!robots.parentNode) document.head.appendChild(robots);
  }, []);

  const submit = async () => {
    if (!form.razao_social?.trim()) {
      toast.error("Razão Social é obrigatória");
      return;
    }
    setSubmitting(true);
    try {
      let logoBase64: string | null = null;
      let logoExt: string | null = null;
      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile);
        logoExt = logoFile.name.split(".").pop() || "png";
      }
      const payload = { ...form };
      // strip preview marker before sending
      if (payload.logo_url === "__pending__") payload.logo_url = "";
      delete (payload as any).id;

      const { data, error } = await supabase.functions.invoke("public-distributor-register", {
        body: { payload, logoBase64, logoExt },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDone(true);
    } catch (e: any) {
      toast.error("Erro ao cadastrar: " + (e?.message || "tente novamente"));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(emptyDistributorForm());
    setLogoFile(null);
    setDone(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">SmartDent</p>
            <h1 className="text-lg font-semibold leading-tight">Cadastro de Distribuidor Credenciado</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {done ? (
          <Card>
            <CardContent className="p-10 text-center space-y-4">
              <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
              <h2 className="text-xl font-semibold">Distribuidor cadastrado!</h2>
              <p className="text-sm text-muted-foreground">
                Recebemos o cadastro. Nossa equipe entrará em contato em breve.
              </p>
              <Button onClick={reset}>Cadastrar outro distribuidor</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-4">
                Preencha os dados da empresa que está sendo credenciada como distribuidora SmartDent.
                Campos com <span className="text-foreground">*</span> são obrigatórios.
              </p>
              <DistributorForm
                value={form}
                onChange={setForm}
                showActive={false}
                logoMode="base64"
                onLogoFileChange={setLogoFile}
              />
              <div className="flex justify-end gap-2 pt-6 border-t mt-6">
                <Button onClick={submit} disabled={submitting} size="lg">
                  {submitting ? "Enviando…" : "Enviar cadastro"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © SmartDent · Cadastro oficial de distribuidores
        </p>
      </main>
    </div>
  );
}
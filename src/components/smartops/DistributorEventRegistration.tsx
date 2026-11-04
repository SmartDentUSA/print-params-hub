import type { FormEvent } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DistributorForm, type DistributorFormValue } from "./DistributorForm";
import { distributorLanguage, distributorText } from "@/lib/distributorI18n";

interface Props {
  value: DistributorFormValue;
  onChange: (value: DistributorFormValue) => void;
  onSubmit: (event: FormEvent) => void;
  submitting: boolean;
  error: string | null;
  isEmbed: boolean;
}

export function DistributorEventRegistration({ value, onChange, onSubmit, submitting, error, isEmbed }: Props) {
  const language = distributorLanguage(value.language_preference);
  const t = (text: string) => distributorText(language, text);
  return (
    <div className={isEmbed ? "bg-background text-foreground" : "min-h-screen bg-background text-foreground"} lang={language}>
      {!isEmbed && <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          <Building2 className="h-7 w-7 shrink-0 text-primary" />
          <div><p className="text-xs text-muted-foreground">Smart Dent | Fluxo Digital</p>
            <h1 className="text-lg font-semibold">{t("Cadastro de Distribuidor Credenciado")}</h1></div>
        </div>
      </header>}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <form onSubmit={onSubmit}>
          <DistributorForm value={value} onChange={onChange} showActive={false} showLogo={false} />
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{t(error)}</p>}
          <div className="mt-6 flex justify-end border-t border-border pt-6">
            <Button type="submit" size="lg" disabled={submitting}>{submitting ? t("Enviando…") : t("Enviar cadastro")}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
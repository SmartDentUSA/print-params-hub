import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FileSignature, FileText, Loader2 } from "lucide-react";

const FN_URL = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/professional-course-portal";

interface ContractInfo {
  id: string;
  number: string;
  status: string;
  body_rendered: string;
  signed_at: string | null;
  adjust_notes: string | null;
  pdf_url: string | null;
}

/** Card do contrato KOL no portal: leitura em modal com rolagem, assinatura digital (gera PDF no Drive) e pedido de ajuste. */
export default function KolContractPortalCard({ token }: { token: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [signed, setSigned] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [checks, setChecks] = useState({ contrato: false, imagem: false, lgpd: false });
  const [adjustNote, setAdjustNote] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [busy, setBusy] = useState(false);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`);
      return json;
    },
    [token],
  );

  const load = useCallback(async () => {
    try {
      const d = await call("contract");
      setContract(d.contract ?? null);
      setSigned(!!d.signed);
    } catch {
      /* sem contrato ou token inválido: o card não aparece */
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !contract) return null;

  const sign = async () => {
    setBusy(true);
    try {
      const r = await call("sign_contract", { checks });
      toast({
        title: "Contrato assinado digitalmente!",
        description: r.pdf_url
          ? "O PDF assinado foi salvo na sua pasta do Google Drive."
          : "Assinatura registrada. O PDF será gerado em instantes.",
      });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Não foi possível assinar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const requestAdjust = async () => {
    setBusy(true);
    try {
      await call("request_adjust", { note: adjustNote });
      toast({ title: "Pedido de ajuste enviado", description: "A equipe Smart Dent vai revisar e te retornar." });
      setShowAdjust(false);
      setModalOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const allChecked = checks.contrato && checks.imagem && checks.lgpd;
  const awaiting = contract.status === "enviado" || contract.status === "rascunho";

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="w-4 h-4" /> Contrato de parceria KOL — {contract.number}
          </CardTitle>
          <Badge variant={signed ? "secondary" : "outline"}>
            {signed ? "Assinado" : contract.status === "ajuste_solicitado" ? "Ajuste em análise" : "Aguardando sua assinatura"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {signed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Assinado digitalmente em{" "}
                {contract.signed_at ? new Date(contract.signed_at).toLocaleString("pt-BR") : "—"}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
                  <FileText className="w-4 h-4 mr-2" /> Ler contrato
                </Button>
                {contract.pdf_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={contract.pdf_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" /> Abrir PDF assinado
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : awaiting ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Leia o contrato completo com atenção e, se estiver de acordo, assine digitalmente.
              </p>
              <Button onClick={() => setModalOpen(true)}>
                <FileText className="w-4 h-4 mr-2" /> Ler e assinar o contrato
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Seu pedido de ajuste foi registrado e está em análise pela equipe Smart Dent.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Contrato de parceria KOL — {contract.number}</DialogTitle>
            <DialogDescription>
              Role até o final para ler todo o documento antes de assinar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-md bg-slate-100 p-3 sm:p-5" style={{ maxHeight: "55vh" }}>
            <ContractDocument body={contract.body_rendered} />
          </div>

          {!signed && awaiting && (
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={checks.contrato} onCheckedChange={(v) => setChecks((c) => ({ ...c, contrato: !!v }))} />
                Li e aceito o Contrato de Cooperação Comercial KOL, incluindo os Anexos I e II.
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={checks.imagem} onCheckedChange={(v) => setChecks((c) => ({ ...c, imagem: !!v }))} />
                Li e aceito o Termo de Autorização de Uso de Imagem, Voz e Nome (Anexo III).
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={checks.lgpd} onCheckedChange={(v) => setChecks((c) => ({ ...c, lgpd: !!v }))} />
                Estou ciente e concordo com o tratamento dos meus dados pessoais conforme a LGPD (Cláusula 10).
              </label>
              {showAdjust && (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="Descreva o que você gostaria de ajustar no contrato…"
                  />
                  <Button size="sm" variant="secondary" onClick={requestAdjust} disabled={busy || adjustNote.trim().length < 5}>
                    Enviar pedido de ajuste
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {signed ? (
              contract.pdf_url ? (
                <Button asChild>
                  <a href={contract.pdf_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Abrir PDF assinado
                  </a>
                </Button>
              ) : null
            ) : awaiting ? (
              <>
                <Button variant="outline" onClick={() => setShowAdjust((s) => !s)} disabled={busy}>
                  Pedir ajuste
                </Button>
                <Button onClick={sign} disabled={!allChecked || busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSignature className="w-4 h-4 mr-2" />}
                  Assinar digitalmente
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

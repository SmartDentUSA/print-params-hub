import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileSignature, Loader2 } from "lucide-react";

const FN_URL = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/kol-portal";

interface ContractInfo {
  id: string; number: string; status: string; body_rendered: string;
  signed_at: string | null; adjust_notes: string | null;
}

/** Card do contrato KOL dentro do portal do profissional: leitura, pedido de ajuste e aceite eletrônico. */
export default function KolContractPortalCard({ token }: { token: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [signed, setSigned] = useState(false);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [checks, setChecks] = useState({ contrato: false, imagem: false, lgpd: false });
  const [adjustNote, setAdjustNote] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`);
    return json;
  }, [token]);

  const load = useCallback(async () => {
    try {
      const d = await call("contract");
      setContract(d.contract ?? null);
      setSigned(!!d.signed);
      setCommissions(d.commissions ?? []);
      setEquipment(d.equipment ?? []);
    } catch {
      /* sem contrato ou token inválido: o card simplesmente não aparece */
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { void load(); }, [load]);

  if (loading || !contract) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await call("accept", { checks });
      toast({ title: "Contrato aceito!", description: "Seu portal foi liberado." });
      await load();
    } catch (e: any) {
      toast({ title: "Não foi possível registrar o aceite", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const requestAdjust = async () => {
    setBusy(true);
    try {
      await call("request_adjust", { note: adjustNote });
      toast({ title: "Pedido de ajuste enviado", description: "A equipe Smart Dent vai revisar e te retornar." });
      setShowAdjust(false);
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const allChecked = checks.contrato && checks.imagem && checks.lgpd;
  const awaiting = contract.status === "enviado" || contract.status === "rascunho";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSignature className="w-4 h-4" /> Contrato de parceria KOL — {contract.number}
        </CardTitle>
        <Badge variant={signed ? "secondary" : "outline"}>
          {signed ? "Assinado" : contract.status === "ajuste_solicitado" ? "Ajuste em análise" : "Aguardando seu aceite"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-md p-4 max-h-96 overflow-y-auto bg-muted/30">
          <pre className="whitespace-pre-wrap text-sm font-sans">{contract.body_rendered}</pre>
        </div>

        {signed ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aceito eletronicamente em {contract.signed_at ? new Date(contract.signed_at).toLocaleString("pt-BR") : "—"}.
            </p>
            {commissions.length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">Sua tabela de comissionamento</h3>
                <div className="border rounded-md divide-y text-sm">
                  {commissions.filter((r) => r?.percent != null).map((r, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5">
                      <span>{r.product_name || r.category}{r.subcategory ? ` · ${r.subcategory}` : ""}</span>
                      <span className="font-medium">{r.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {equipment.length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">Equipamentos em comodato</h3>
                <div className="border rounded-md divide-y text-sm">
                  {equipment.map((e, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5">
                      <span>{e.product_name}{e.serial_number ? ` · S/N ${e.serial_number}` : ""}</span>
                      <Badge variant="outline">{e.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : awaiting ? (
          <div className="space-y-3">
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={accept} disabled={!allChecked || busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSignature className="w-4 h-4 mr-2" />}
                Li e aceito
              </Button>
              <Button variant="outline" onClick={() => setShowAdjust((s) => !s)} disabled={busy}>
                Pedir ajuste
              </Button>
            </div>
            {showAdjust && (
              <div className="space-y-2">
                <Textarea rows={3} value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Descreva o que você gostaria de ajustar no contrato…" />
                <Button size="sm" variant="secondary" onClick={requestAdjust} disabled={busy || adjustNote.trim().length < 5}>
                  Enviar pedido de ajuste
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Seu pedido de ajuste foi registrado e está em análise pela equipe Smart Dent.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, QrCode, Ticket } from "lucide-react";

interface MaterialForm {
  id: string;
  name: string;
  url: string;
}
interface MaterialCoupon {
  code: string;
  active_from: string | null;
  active_to: string | null;
}

interface Props {
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
}

/** Materiais de divulgação: QR codes do formulário de indicação e dos cupons, com download em PNG. */
export default function PortalMaterials({ call }: Props) {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<MaterialForm[]>([]);
  const [coupons, setCoupons] = useState<MaterialCoupon[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await call("materials");
        if (cancelled) return;
        const fs: MaterialForm[] = data.forms ?? [];
        setForms(fs);
        setCoupons(data.coupons ?? []);
        const map: Record<string, string> = {};
        for (const f of fs) {
          map[f.id] = await QRCode.toDataURL(f.url, { width: 640, margin: 2 });
        }
        if (!cancelled) setQrs(map);
      } catch {
        /* silencioso: seção informativa */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [call]);

  const download = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  if (loading) {
    return (
      <Card><CardContent className="py-6 flex items-center text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando materiais…
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center"><QrCode className="w-4 h-4 mr-2" /> QR code do formulário de indicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {forms.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum formulário de indicação vinculado ainda. Ele é criado automaticamente quando o contrato de parceria é assinado.
            </p>
          )}
          {forms.map((f) => (
            <div key={f.id} className="flex flex-col sm:flex-row items-center gap-4 border rounded-lg p-4">
              {qrs[f.id] && <img src={qrs[f.id]} alt={`QR code ${f.name}`} className="w-40 h-40" />}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <p className="font-medium text-sm">{f.name}</p>
                <p className="text-xs text-muted-foreground break-all">{f.url}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => qrs[f.id] && download(qrs[f.id], `qrcode-${f.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`)}
                  disabled={!qrs[f.id]}
                >
                  <Download className="w-4 h-4 mr-2" /> Baixar QR code (PNG)
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center"><Ticket className="w-4 h-4 mr-2" /> Cupons ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cupom ativo no momento.</p>
          ) : (
            <ul className="divide-y">
              {coupons.map((c) => (
                <li key={c.code} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-mono font-medium">{c.code}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.active_to ? `válido até ${new Date(c.active_to).toLocaleDateString("pt-BR")}` : "sem validade"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Os cupons valem na loja online: loja.smartdent.com.br
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

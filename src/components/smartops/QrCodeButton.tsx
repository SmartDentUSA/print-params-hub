import { useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** Destino codificado no QR Code */
  url: string;
  /** Nome amigável (usado no título e no arquivo baixado) */
  title: string;
  /** Sufixo para o nome do arquivo (ex.: "form", "landing-page") */
  fileSuffix?: string;
  /** Estilo compacto (ícone) ou botão com rótulo */
  compact?: boolean;
}

function slugifyName(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "qrcode"
  );
}

export function QrCodeButton({ url, title, fileSuffix, compact = true }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  const generate = async () => {
    if (!url) {
      toast.error("Sem link para gerar o QR Code");
      return;
    }
    setOpen(true);
    if (pngUrl) return;
    setLoading(true);
    try {
      const png = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#111111", light: "#FFFFFF" },
      });
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#111111", light: "#FFFFFF" },
      });
      setPngUrl(png);
      setSvgMarkup(svg);
    } catch (err) {
      console.error("[QrCodeButton]", err);
      toast.error("Falha ao gerar o QR Code");
    } finally {
      setLoading(false);
    }
  };

  const baseName = `qrcode-${slugifyName(title)}${fileSuffix ? `-${fileSuffix}` : ""}`;

  const download = (href: string, ext: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    download(href, "svg");
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  };

  return (
    <>
      {compact ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-6 px-1.5 text-[10px] gap-1"
          onClick={generate}
          title="Gerar QR Code para download"
        >
          <QrCode className="w-3 h-3" />
          QR Code
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={generate}>
          <QrCode className="w-4 h-4" />
          Gerar QR Code
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">QR Code — {title}</DialogTitle>
            <DialogDescription className="break-all font-mono text-[11px]">{url}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {loading || !pngUrl ? (
              <div className="h-56 w-56 flex items-center justify-center rounded-md border">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <img
                src={pngUrl}
                alt={`QR Code de ${title}`}
                className="h-56 w-56 rounded-md border bg-background"
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={!pngUrl} onClick={() => pngUrl && download(pngUrl, "png")} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                PNG
              </Button>
              <Button size="sm" variant="outline" disabled={!svgMarkup} onClick={downloadSvg} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                SVG
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

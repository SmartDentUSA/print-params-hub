import { Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CLICK_ORIGINS, CLICK_ORIGIN_LABEL, withClickOrigin } from "@/lib/clickOrigin";

/** Copia o link curto já marcado com a origem do clique (e-mail, SMS, WhatsApp, grupos, Bio). */
export function ShortLinkOriginMenu({ code }: { code: string }) {
  const base = `https://s.smartdent.com.br/${code}`;
  const copy = (url: string, label: string) =>
    navigator.clipboard.writeText(url).then(
      () => toast.success(`Link para ${label} copiado: ${url}`),
      () => toast.error("Falha ao copiar"),
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded px-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Copiar link com a origem do clique"
          aria-label="Copiar link com a origem do clique"
        >
          <Share2 className="w-3 h-3" />
          origem
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">Copiar link para…</DropdownMenuLabel>
        {CLICK_ORIGINS.map((o) => {
          const url = withClickOrigin(base, o);
          return (
            <DropdownMenuItem key={o} onSelect={() => copy(url, CLICK_ORIGIN_LABEL[o])} className="flex flex-col items-start gap-0">
              <span className="text-xs font-medium">{CLICK_ORIGIN_LABEL[o]}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{url.replace("https://", "")}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

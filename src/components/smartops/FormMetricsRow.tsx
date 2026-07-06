import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ExternalLink,
  Pencil,
  Trash2,
  Settings,
  CopyPlus,
  Copy,
  Layout,
  Link2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { FormMetrics, ShortLinkInfo } from "./FormMetricsCard";

interface Props {
  form: any;
  metrics?: FormMetrics;
  purposeLabel: string;
  purposeColor: string;
  hasLandingPage?: boolean;
  shortLinkForm?: ShortLinkInfo | null;
  shortLinkLanding?: ShortLinkInfo | null;
  generatingTarget?: "form" | "landing_page" | null;
  onGenerateShortLink?: (target: "form" | "landing_page") => void;
  onToggleActive: () => void;
  onEditMeta: () => void;
  onEditFields: () => void;
  onEditLandingPage: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onCopyEmbed: () => void;
  onDelete: () => void;
}

function Sparkline({ series }: { series: Array<{ d: string; v: number }> }) {
  const data = series && series.length > 0 ? series : [];
  if (data.length < 2) {
    return <div className="h-6 flex items-end text-[10px] text-muted-foreground">—</div>;
  }
  const w = 80;
  const h = 20;
  const max = Math.max(...data.map((p) => p.v), 1);
  const step = w / (data.length - 1);
  const points = data
    .map((p, i) => `${(i * step).toFixed(1)},${(h - (p.v / max) * h).toFixed(1)}`)
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={areaPoints} fill="hsl(var(--primary) / 0.12)" stroke="none" />
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
}

function pct(n: number, d: number) {
  if (!d || d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function ShortChip({
  label,
  info,
  busy,
  onGenerate,
}: {
  label: string;
  info: ShortLinkInfo | null | undefined;
  busy: boolean;
  onGenerate?: () => void;
}) {
  if (info) {
    const url = `https://s.smartdent.com.br/${info.short_code}`;
    const copy = () =>
      navigator.clipboard.writeText(url).then(
        () => toast.success("Link curto copiado"),
        () => toast.error("Falha ao copiar"),
      );
    return (
      <div className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] bg-muted/40">
        <Badge variant="secondary" className="text-[9px] py-0 px-1 h-4">{label}</Badge>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
          title="Copiar link curto"
        >
          <Link2 className="w-3 h-3" />
          s.smartdent.com.br/{info.short_code}
          <Copy className="w-2.5 h-2.5 opacity-60" />
        </button>
        <span className="text-muted-foreground tabular-nums">
          · {info.click_count.toLocaleString()}
        </span>
      </div>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-6 px-1.5 text-[10px] gap-1"
      disabled={busy || !onGenerate}
      onClick={onGenerate}
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
      {label} · gerar curto
    </Button>
  );
}

export function FormMetricsRow({
  form,
  metrics,
  purposeLabel,
  purposeColor,
  hasLandingPage,
  shortLinkForm,
  shortLinkLanding,
  generatingTarget,
  onGenerateShortLink,
  onToggleActive,
  onEditMeta,
  onEditFields,
  onEditLandingPage,
  onDuplicate,
  onCopyLink,
  onCopyEmbed,
  onDelete,
}: Props) {
  const m = metrics ?? { visitors: 0, unique_visitors: 0, leads: 0, deals_won: 0, daily_series: [] };
  const completion = pct(m.leads, m.unique_visitors);
  const conversion = pct(m.deals_won, m.leads);

  return (
    <div className="grid grid-cols-12 gap-2 items-center px-3 py-2 border-b hover:bg-muted/30 transition-colors text-sm">
      {/* Ativo */}
      <div className="col-span-1 md:col-span-1 flex items-center">
        <Switch checked={form.active} onCheckedChange={onToggleActive} />
      </div>

      {/* Nome + links curtos */}
      <div className="col-span-11 md:col-span-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{form.name}</span>
          <Badge variant="outline" className={`${purposeColor} text-[10px] py-0 px-1.5`}>
            {purposeLabel}
          </Badge>
          <span className="text-[11px] text-muted-foreground font-mono">/f/{form.slug}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <ShortChip
            label="Form"
            info={shortLinkForm}
            busy={generatingTarget === "form"}
            onGenerate={() => onGenerateShortLink?.("form")}
          />
          {hasLandingPage && (
            <ShortChip
              label="LP"
              info={shortLinkLanding}
              busy={generatingTarget === "landing_page"}
              onGenerate={() => onGenerateShortLink?.("landing_page")}
            />
          )}
        </div>
      </div>

      {/* Visitantes */}
      <div className="hidden md:flex md:col-span-2 items-center gap-2">
        <div className="min-w-0">
          <div className="text-base font-semibold tabular-nums leading-tight">
            {m.visitors.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {m.unique_visitors.toLocaleString()} únicos
          </div>
        </div>
        <Sparkline series={m.daily_series} />
      </div>

      {/* Leads */}
      <div className="hidden md:block md:col-span-2">
        <div className="text-base font-semibold tabular-nums leading-tight">
          {m.leads.toLocaleString()}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {completion !== null ? `${completion}% preench.` : "—"}
        </div>
      </div>

      {/* Conversão */}
      <div className="hidden md:block md:col-span-1">
        <div className="text-base font-semibold tabular-nums leading-tight">
          {conversion !== null ? `${conversion}%` : "—"}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {m.deals_won.toLocaleString()} ganhas
        </div>
      </div>

      {/* Sub-row mobile (Vis/Leads/Conv juntos) */}
      <div className="md:hidden col-span-12 flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
        <span><b className="text-foreground">{m.visitors.toLocaleString()}</b> vis</span>
        <span><b className="text-foreground">{m.leads.toLocaleString()}</b> leads</span>
        <span><b className="text-foreground">{conversion !== null ? `${conversion}%` : "—"}</b> conv</span>
        <span className="ml-auto">{m.deals_won.toLocaleString()} ganhas</span>
      </div>

      {/* Ações */}
      <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-0.5">
        <Button variant="ghost" size="icon" onClick={onEditMeta} title="Editar nome/config" className="h-7 w-7">
          <Settings className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEditLandingPage} title="Landing page" className="h-7 w-7">
          <Layout className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEditFields} title="Editar campos" className="h-7 w-7">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicar" className="h-7 w-7">
          <CopyPlus className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onCopyLink} title="Copiar link" className="h-7 w-7">
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onCopyEmbed} title="Copiar embed" className="h-7 w-7">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir" className="h-7 w-7">
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Pencil, Trash2, Settings, CopyPlus, Copy, Layout } from "lucide-react";

export interface FormMetrics {
  visitors: number;
  unique_visitors: number;
  leads: number;
  deals_won: number;
  daily_series: Array<{ d: string; v: number }>;
}

interface Props {
  form: any;
  metrics?: FormMetrics;
  purposeLabel: string;
  purposeColor: string;
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
    return <div className="h-8 flex items-end text-xs text-muted-foreground">—</div>;
  }
  const w = 120;
  const h = 28;
  const max = Math.max(...data.map((p) => p.v), 1);
  const step = data.length > 1 ? w / (data.length - 1) : w;
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

export function FormMetricsCard({
  form,
  metrics,
  purposeLabel,
  purposeColor,
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
    <Card className="flex flex-col">
      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{form.name}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className={`${purposeColor} text-[10px] py-0 px-1.5`}>
                {purposeLabel}
              </Badge>
              <span className="text-[10px] text-muted-foreground truncate">/f/{form.slug}</span>
            </div>
          </div>
          <Switch checked={form.active} onCheckedChange={onToggleActive} />
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Visitantes</div>
            <div className="text-xl font-semibold tabular-nums">{m.visitors.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">
              {m.unique_visitors.toLocaleString()} únicos
            </div>
            <div className="mt-1"><Sparkline series={m.daily_series} /></div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Leads</div>
            <div className="text-xl font-semibold tabular-nums">{m.leads.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">
              {completion !== null ? `${completion}% preench.` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversão</div>
            <div className="text-xl font-semibold tabular-nums">
              {conversion !== null ? `${conversion}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {m.deals_won.toLocaleString()} ganhas
            </div>
          </div>
        </div>

        <div className="flex gap-1 justify-end pt-2 border-t mt-auto">
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
      </CardContent>
    </Card>
  );
}
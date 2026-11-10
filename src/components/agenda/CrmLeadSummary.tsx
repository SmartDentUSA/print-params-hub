import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Briefcase, CalendarClock, MapPin } from "lucide-react";

export type SummaryDeal = {
  deal_id: string; pipeline_name: string | null; stage_name: string | null; status: string | null; owner_name: string | null;
  value: number | null; product: string | null; origin_name: string | null; title?: string | null; created_at: string | null; closed_at?: string | null;
};

const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const brl = (v: unknown) => {
  const n = Number(v);
  return v == null || !Number.isFinite(n) || n === 0 ? "" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
const STATUS_LABEL: Record<string, string> = { EM_NEGOCIACAO: "Em negociação", CLIENTE_ATIVO: "Cliente ativo", PERDIDA_RENUTRIR: "Perdido · renutrir" };
const human = (s?: string | null) => {
  if (s && STATUS_LABEL[s.toUpperCase()]) return STATUS_LABEL[s.toUpperCase()];
  const t = String(s ?? "").replace(/_/g, " ").trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
};
const STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  aberta: { label: "Aberto", dot: "bg-primary", badge: "border-primary/40 bg-primary/10 text-primary" },
  ganha: { label: "Ganho", dot: "bg-success", badge: "border-success/40 bg-success/10 text-success" },
  perdida: { label: "Perdido", dot: "bg-muted-foreground", badge: "border-border bg-muted text-muted-foreground" },
};
export const dealStatus = (s?: string | null) => STATUS[String(s ?? "")] ?? { label: s ?? "—", dot: "bg-muted-foreground", badge: "border-border bg-muted text-muted-foreground" };

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
      {aside}
    </div>
  );
}

export function CrmLeadSummary({ lead, person, deals, conversions, extras }: {
  lead: any | null; person: any | null; deals: SummaryDeal[];
  conversions: { date: string | null; name: string }[]; extras?: { courses: string[]; tickets: number };
}) {
  const name = lead?.nome || person?.nome || "Lead sem nome";
  const company = lead?.empresa_nome || person?.empresa_nome;
  const place = [lead?.cidade, lead?.uf].filter(Boolean).join("/");
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]).join("").toUpperCase();
  const doc = lead?.doc ?? person?.doc;
  const ordered = [...deals].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const open = deals.filter((d) => d.status === "aberta").length;
  const won = deals.filter((d) => d.status === "ganha");
  const lost = deals.filter((d) => d.status === "perdida").length;
  const wonValue = brl(won.reduce((s, d) => s + (Number(d.value) || 0), 0));
  const interest = lead?.produto_interesse || lead?.produto_interesse_auto;
  const equip = [lead?.equip_scanner && `Scanner ${lead.equip_scanner}`, lead?.equip_impressora && `Impressora ${lead.equip_impressora}`, lead?.equip_cad && `CAD ${lead.equip_cad}`]
    .filter((v) => v && !/(n[aã]o|nenhum)$/i.test(String(v))).join(" · ");
  const ecommerce = lead?.lojaintegrada_ultimo_pedido_data ? [dt(lead.lojaintegrada_ultimo_pedido_data), brl(lead.lojaintegrada_ultimo_pedido_valor)].filter(Boolean).join(" · ") : "";

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Quem é */}
      <div className="flex items-start gap-3 border-b bg-muted/40 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials || "?"}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resumo do lead</p>
          <p className="truncate text-base font-semibold leading-tight">{name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {company && <span className="truncate">{company}</span>}
            {place && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{place}</span>}
            {lead?.created_at && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />No sistema desde {dt(lead.created_at)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {lead?.real_status && <Badge variant="outline" className="text-[10px]">{human(lead.real_status)}</Badge>}
          {doc?.badge && <Badge variant="outline" className="text-[10px]">{doc.badge}</Badge>}
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Relação com a Smart Dent */}
        {lead && (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Responsável" value={lead.proprietario_lead_crm} />
            <Fact label="Primeira origem" value={lead.origem_primeiro_contato} />
            <Fact label="Última conversão" value={lead.form_name} />
            <Fact label="Produto de interesse" value={interest} />
            <Fact label="Área / especialidade" value={[lead.area_atuacao, lead.especialidade].filter(Boolean).join(" · ")} />
            <Fact label="Documento" value={doc?.label?.replace(/^Pessoa (física|jurídica)( e jurídica)? · /, "")} />
            <Fact label="Equipamentos" value={equip} />
            <Fact label="Faturamento" value={[brl(lead.ltv_total) && `LTV ${brl(lead.ltv_total)}`, brl(lead.omie_faturamento_total) && `ERP ${brl(lead.omie_faturamento_total)}`].filter(Boolean).join(" · ")} />
            <Fact label="Último pedido e-commerce" value={ecommerce} />
            <Fact label="Cursos / treinamentos" value={extras?.courses?.length ? extras.courses.join("; ") : ""} />
            <Fact label="Suporte" value={extras?.tickets ? `${extras.tickets} chamado(s)` : ""} />
          </dl>
        )}

        {/* Histórico de negócios */}
        {!!ordered.length && (
          <div>
            <SectionTitle aside={
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{deals.length} negócio(s)</Badge>
                {!!open && <Badge variant="outline" className={cn("text-[10px]", STATUS.aberta.badge)}>{open} aberto(s)</Badge>}
                {!!won.length && <Badge variant="outline" className={cn("text-[10px]", STATUS.ganha.badge)}>{won.length} ganho(s){wonValue ? ` · ${wonValue}` : ""}</Badge>}
                {!!lost && <Badge variant="outline" className={cn("text-[10px]", STATUS.perdida.badge)}>{lost} perdido(s)</Badge>}
              </div>
            }>Histórico de negócios</SectionTitle>
            <ol className="relative ml-1.5 space-y-3 border-l pl-4">
              {ordered.map((d) => {
                const st = dealStatus(d.status);
                return (
                  <li key={d.deal_id} className="relative">
                    <span className={cn("absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-card", st.dot)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{[d.pipeline_name, d.stage_name].filter(Boolean).join(" · ") || "Funil não identificado"}</span>
                      <Badge variant="outline" className={cn("text-[10px]", st.badge)}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[dt(d.created_at) || "sem data", `#${d.deal_id}`, d.owner_name, brl(d.value), d.status !== "aberta" && d.closed_at ? `fechado em ${dt(d.closed_at)}` : ""].filter(Boolean).join(" · ")}
                    </p>
                    {(d.origin_name || d.product) && (
                      <p className="text-xs text-muted-foreground">{[d.origin_name && `Origem: ${d.origin_name}`, d.product && `Produto: ${d.product}`].filter(Boolean).join(" · ")}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Conversões */}
        {!!conversions.length && (
          <div>
            <SectionTitle>Conversões recentes</SectionTitle>
            <ul className="divide-y rounded-lg border">
              {conversions.map((c, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{dt(c.date)}</span>
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words">{c.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

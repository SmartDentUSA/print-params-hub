// Resumo textual do lead para o vendedor: quem é, relação com a Smart Dent,
// timeline dos negócios e conversões recentes. Só dados já existentes no sistema.
import type { DealView } from "./rules.ts";

export type SummaryBlock = { title: string; lines: string[] };

const dt = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};
const brl = (v: unknown) => {
  const n = Number(v);
  return v == null || !Number.isFinite(n) || n === 0 ? "" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
const join = (parts: unknown[], sep = " · ") => parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(sep);
const yes = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s && !/^(n[aã]o|nenhum|false|null|-)$/i.test(s) ? s : "";
};

export function buildLeadSummary(lead: any, deals: DealView[], activity: any[]): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  if (lead) {
    blocks.push({
      title: "Quem é",
      lines: [
        join([lead.nome, lead.area_atuacao, lead.especialidade]),
        join([lead.empresa_nome, [lead.cidade, lead.uf].filter(Boolean).join("/")]),
        join([
          yes(lead.equip_scanner) && `Scanner: ${lead.equip_scanner}`,
          yes(lead.equip_impressora) && `Impressora: ${lead.equip_impressora}`,
          yes(lead.equip_cad) && `CAD: ${lead.equip_cad}`,
        ]),
      ].filter(Boolean),
    });
    const courses = activity.filter((a) => a.event_type === "inscricao_curso_publica" || a.event_type === "treinamento_finalizado");
    const tickets = activity.filter((a) => a.event_type === "support_ticket_created").length;
    blocks.push({
      title: "Relação com a Smart Dent",
      lines: [
        join([lead.created_at && `No sistema desde ${dt(lead.created_at)}`, lead.origem_primeiro_contato && `primeira origem: ${lead.origem_primeiro_contato}`]),
        join([lead.real_status && `Status: ${lead.real_status}`, lead.proprietario_lead_crm && `responsável: ${lead.proprietario_lead_crm}`]),
        join([lead.form_name && `Última conversão: ${lead.form_name}`, (lead.produto_interesse || lead.produto_interesse_auto) && `interesse: ${lead.produto_interesse || lead.produto_interesse_auto}`]),
        join([
          brl(lead.ltv_total) && `LTV ${brl(lead.ltv_total)}`,
          brl(lead.omie_faturamento_total) && `faturado ERP ${brl(lead.omie_faturamento_total)}`,
          lead.omie_ultima_compra && `última compra ERP ${dt(lead.omie_ultima_compra)}`,
        ]),
        lead.lojaintegrada_ultimo_pedido_data
          ? join([`Último pedido e-commerce ${dt(lead.lojaintegrada_ultimo_pedido_data)}`, brl(lead.lojaintegrada_ultimo_pedido_valor)])
          : "",
        courses.length
          ? `Cursos/treinamentos: ${[...new Set(courses.map((c) => c.entity_name).filter(Boolean))].slice(0, 4).join("; ") || courses.length}`
          : lead.astron_courses_total ? `Cursos online: ${lead.astron_courses_completed ?? 0}/${lead.astron_courses_total} concluídos` : "",
        tickets ? `${tickets} chamado(s) de suporte` : "",
      ].filter(Boolean),
    });
  }

  if (deals.length) {
    const won = deals.filter((d) => d.status === "ganha");
    const open = deals.filter((d) => d.status === "aberta");
    const lost = deals.filter((d) => d.status === "perdida");
    const wonValue = won.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const timeline = [...deals]
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
      .map((d) => join([
        dt(d.created_at) || "sem data",
        `#${d.deal_id}`,
        join([d.pipeline_name, d.stage_name], " / "),
        d.status,
        d.owner_name,
        d.origin_name || d.title,
        brl(d.value),
        d.closed_at && d.status !== "aberta" ? `fechado ${dt(d.closed_at)}` : "",
      ]));
    blocks.push({
      title: "Histórico de negócios",
      lines: [
        join([`${deals.length} negócio(s)`, `${open.length} aberto(s)`, `${won.length} ganho(s)${wonValue ? ` (${brl(wonValue)})` : ""}`, `${lost.length} perdido(s)`]),
        ...timeline,
      ],
    });
  }

  const conv = activity.filter((a) => a.event_type === "form_submission" || a.event_type === "meta_ads_lead_entry" || a.event_type === "crm_insercao");
  if (conv.length) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const c of conv) {
      const key = `${String(c.event_timestamp).slice(0, 10)}|${c.entity_name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(join([dt(c.event_timestamp), c.entity_name || c.event_type]));
      if (lines.length >= 8) break;
    }
    blocks.push({ title: `Conversões recentes (${conv.length} no total)`, lines });
  }
  return blocks.filter((b) => b.lines.length);
}

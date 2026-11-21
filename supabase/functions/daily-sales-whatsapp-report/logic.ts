const brl = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SOURCE_LABEL: Record<string, string> = {
  piperun: "CRM (PipeRun)", piperun_webhook: "CRM (PipeRun)", loja_integrada: "Loja virtual",
  astron_postback: "Astron (cursos)", "dra-lia": "Dra. LIA", wats: "WhatsApp", whats: "WhatsApp", unknown: "Sem origem",
};

/** Origem curta para WhatsApp: tira "# -", troca [TAG] por "Tag ·" e corta nomes longos. */
export function shortOrigin(raw: string): string {
  const k = String(raw ?? "").trim();
  if (SOURCE_LABEL[k.toLowerCase()]) return SOURCE_LABEL[k.toLowerCase()];
  let s = k.replace(/^#\s*-?\s*/, "").replace(/\s+—.*$/, "");
  const tag = s.match(/^\[\s*([^\]]+?)\s*\]\s*-?\s*/);
  if (tag) {
    const t = tag[1].toUpperCase() === "META" ? "Meta" : tag[1].charAt(0) + tag[1].slice(1).toLowerCase();
    const rest = s.slice(tag[0].length).replace(/^[-\s]+/, "");
    s = rest ? `${t} · ${rest}` : t;
  }
  s = s.replace(/\s+-\s+Smart Dent$/i, "").trim() || "Sem origem";
  return s.length > 34 ? s.slice(0, 33).trimEnd() + "…" : s;
}

const MAX_ORIGINS = 6;
export function buildText(r: any): string {
  const [y, m, d] = String(r.day).split("-");
  const merged = new Map<string, number>();
  for (const o of r.leads_by_origin ?? []) merged.set(shortOrigin(o.origem), (merged.get(shortOrigin(o.origem)) ?? 0) + Number(o.total));
  const sorted = [...merged.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, MAX_ORIGINS);
  const rest = sorted.slice(MAX_ORIGINS).reduce((n, [, v]) => n + v, 0);
  const lines = [`📊 *Resumo Smart Dent* · ${d}/${m}/${y}`, "", `👥 *Leads hoje:* ${r.leads_total}`];
  for (const [o, n] of top) lines.push(`   ▫️ ${o}: ${n}`);
  if (rest) lines.push(`   ▫️ Outras: ${rest}`);
  const ltv = Number(r.leads_month_ltv ?? 0);
  lines.push(`📅 *Leads no mês:* ${r.leads_month_total ?? 0}`,
    `   🆕 Novos: ${Number(r.leads_month_total ?? 0) - ltv}`,
    `   💎 Já clientes (com LTV): ${ltv} · ${brl(r.leads_month_ltv_value)}`, "",
    `💰 *Ganhos hoje:* ${brl(r.won_day_value)} (${r.won_day_count})`,
    `🏆 *Ganhos no mês:* ${brl(r.won_month_value)} (${r.won_month_count})`, "", `_Mês até ${d}/${m}_`);
  return lines.join("\n");
}


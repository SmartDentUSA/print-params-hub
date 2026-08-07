import { PainelOrigemRow } from "@/hooks/painel/usePainelComercial";

/** Remove acentos, prefixos de canal e ruído para comparar origens/campanhas por similaridade. */
export function canonicalOriginKey(raw?: string | null): string {
  if (!raw) return "nao-informado";
  let s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // prefixos de canal / formatação do CRM
  s = s
    .replace(/^[\s»#\-–—_.]+/g, "")
    .replace(/^meta\s*ads\s*[—\-–:]*\s*/g, "")
    .replace(/^(facebook|instagram|face|fb|ig)\s*[—\-–:]*\s*/g, "")
    .replace(/^\[?\s*(leads?|cadastro|organico|orgânico|forms?|formulario)\s*\]?\s*[—\-–:]*\s*/g, "")
    .replace(/^form\s+\d+\s*$/g, "form-generico");

  // typos e variações conhecidas
  s = s
    .replace(/impresoras?/g, "impressora")
    .replace(/impressoras/g, "impressora")
    .replace(/reativcao|reativacao/g, "reativacao")
    .replace(/smart\s*a\.?\s*i\.?\s*pro/g, "smart ai pro")
    .replace(/smartaipro/g, "smart ai pro")
    .replace(/exocad\s*dentalcad/g, "exocad")
    .replace(/\bsmart\s*dent\b/g, "smartdent")
    .replace(/\bsmartdent\b/g, "");

  // normaliza separadores e remove tokens de ruído
  s = s.replace(/[^a-z0-9]+/g, " ").trim();
  const stop = new Set(["de", "do", "da", "e", "leads", "lead", "copy", "smartdent", "meta", "ads"]);
  const tokens = s
    .split(" ")
    .filter((t) => t && !stop.has(t))
    .sort();

  return tokens.join("-") || "nao-informado";
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? 0 : v);

/** Agrupa linhas de origem por similaridade (origem + campanha canonizadas) e reagrega as métricas. */
export function mergeOriginRows(rows: PainelOrigemRow[]): PainelOrigemRow[] {
  const groups = new Map<string, PainelOrigemRow[]>();

  for (const r of rows) {
    const key = `${r.tipo ?? ""}|${canonicalOriginKey(r.origem)}|${canonicalOriginKey(r.campanha)}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const merged: PainelOrigemRow[] = [];

  groups.forEach((list) => {
    if (list.length === 1) {
      merged.push(list[0]);
      return;
    }

    // rótulo do grupo = linha com mais leads
    const principal = [...list].sort((a, b) => num(b.leads_gerados) - num(a.leads_gerados))[0];

    const leads = list.reduce((s, r) => s + num(r.leads_gerados), 0);
    const ativos = list.reduce((s, r) => s + num(r.ativos), 0);
    const perdidos = list.reduce((s, r) => s + num(r.perdidos), 0);
    const ganhos = list.reduce((s, r) => s + num(r.ganhos), 0);
    const ganhosCoorte = list.reduce((s, r) => s + num(r.ganhos_coorte), 0);
    const receita = list.reduce((s, r) => s + num(r.receita), 0);

    // lead time médio ponderado pelos ganhos (fallback: leads)
    const comTempo = list.filter((r) => r.lead_time_dias !== null && r.lead_time_dias !== undefined);
    const pesoTotal = comTempo.reduce((s, r) => s + (num(r.ganhos) || num(r.leads_gerados)), 0);
    const leadTime =
      comTempo.length === 0 || pesoTotal === 0
        ? comTempo.length
          ? comTempo.reduce((s, r) => s + num(r.lead_time_dias), 0) / comTempo.length
          : null
        : comTempo.reduce((s, r) => s + num(r.lead_time_dias) * (num(r.ganhos) || num(r.leads_gerados)), 0) /
          pesoTotal;

    // etapa de maior perda = etapa da linha com mais perdidos
    const etapa =
      [...list]
        .filter((r) => r.etapa_maior_perda)
        .sort((a, b) => num(b.perdidos) - num(a.perdidos))[0]?.etapa_maior_perda ?? null;

    merged.push({
      ...principal,
      leads_gerados: leads,
      ativos,
      perdidos,
      ganhos,
      ganhos_coorte: ganhosCoorte,
      receita,
      lead_time_dias: leadTime,
      pct_perda: leads > 0 ? (perdidos / leads) * 100 : null,
      // conversão sobre a própria coorte: `ganhos` são fechamentos do mês e podem
      // vir de leads antigos, o que produzia conversões acima de 100%.
      pct_conversao: leads > 0 ? (ganhosCoorte / leads) * 100 : null,
      etapa_maior_perda: etapa,
    });
  });

  return merged.sort((a, b) => num(b.leads_gerados) - num(a.leads_gerados));
}
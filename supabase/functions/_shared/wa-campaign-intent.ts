import { buttonKey, isOptOutText, normLabel } from './wa-button-replies.ts';
import { normalizeBrazilianPhone } from './phone-normalize.ts';

export type CampaignIntent = 'information' | 'contact' | 'none';

// Explicit interest only. Greetings, away messages and other businesses' menus
// are not conversions; this classifier never sends the text to an LLM.
export function campaignIntent(text: unknown, button?: unknown): CampaignIntent {
  const raw = String(button || text || '');
  const n = normLabel(raw);
  if (!n || isOptOutText(n) || /\b(nao (?:quero|desejo|tenho interesse)|remov[ae]|retir[ae].*lista|pare de|nao envie|nao mand[ae])\b/.test(n)) return 'none';
  if (/agradec(?:e|emos|o).*contato|agradec(?:o|emos).*mensagem|nao estamos disponiveis|fora do horario|horario de atendimento|responderemos|retornaremos|assim que possivel|seja.*bem.vind|mensagens.*ordem|agend(?:amento|ar).*(?:consulta|procedimento)|o que.*incomoda.*sorriso|como (?:podemos|posso) (?:ajudar|te ajudar)|qual.*tratamento.*procura|secretaria.*clinica/.test(n)) return 'none';
  if (button) {
    const key = buttonKey(button);
    if (key === 'consultor') return 'contact';
    if (key === 'ofertas') return 'information';
  }
  if (/(?:quero|gostaria|preciso|pode|poderia|desejo|solicito).*(?:falar|conversar|contato|me ligar|ligar para mim|consultor|vendedor|atendente)|(?:me ligue|me chama|me chame|entre em contato|fale comigo|falar com (?:consultor|vendedor))/.test(n)) return 'contact';
  if (/(?:quero|gostaria|preciso|desejo|solicito|pode|poderia|eu quero).*(?:saber|informac|informar|detalhes|conhecer|orcamento|preco|valor|comprar|adquirir|ajuda|catalogo|oferta|promoc|cotac|investimento)/.test(n)) return 'information';
  if (/(?:qual|quanto|como|tem|voc[eê]s? (?:tem|vend)|possui).*(?:resina|impressora|scanner|combo|mini.?vat|exoplan|exocad|preco|valor|custa|pagamento|parcela|desconto|curso)|(?:resina|impressora|scanner|combo|exoplan|exocad).*(?:preco|valor|custa|funciona|\?)/.test(n)) return 'information';
  if (/(?:me (?:passa|passe|manda|mande|envia|envie)|tenho interesse|estou interessad[oa])|^(?:mais informacoes|informacoes|detalhes|preco|valor|valores|orcamento|catalogo|como funciona)[.!? ]*$/.test(n)) return 'information';
  if (/^(?:exoplan|exocad|dentalcad|quero saber mais|falar com consultor)[.!? ]*$/.test(n)) return n.startsWith('falar') ? 'contact' : 'information';
  return 'none';
}

export function campaignPhone(raw: string): { phone: string; variants: string[] } | null {
  const phone = normalizeBrazilianPhone(raw);
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  const values = new Set([d, phone]);
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') {
    const legacy = d.slice(0, 4) + d.slice(5);
    values.add(legacy); values.add(`+${legacy}`);
    values.add(d.slice(2)); values.add(legacy.slice(2));
  }
  return { phone, variants: [...values] };
}

// A conversation's several replies/buttons are one commercial conversion per
// campaign, unlike separate submissions on an actual public form.
export function campaignSubmissionId(campaignId: string, phone: string): string {
  const canonical = campaignPhone(phone);
  if (!canonical) throw new Error('invalid phone');
  return `wa-campaign:${campaignId}:${canonical.phone}`;
}

export type InterestCategory = { label: string; product_name?: string | null; product_catalog_id?: string | null; workflow_stage_target?: string | null };

export function selectedCategory(jobId: string, categories: InterestCategory[], value: unknown): number | null {
  const raw = String(value ?? '').trim();
  const m = /^wa-interest:([0-9a-f-]+):(\d+)$/i.exec(raw);
  if (m) {
    const index = Number(m[2]);
    return m[1] === jobId && Number.isInteger(index) && index >= 0 && index < categories.length ? index : null;
  }
  // Typed canonical labels work too, but only inside the already sent menu.
  const index = categories.findIndex((c) => normLabel(c.label) === normLabel(raw));
  return index >= 0 ? index : null;
}

export function categoryMenu(jobId: string, categories: InterestCategory[], page = 0) {
  const perPage = categories.length > 10 ? 9 : 10;
  const start = page * perPage;
  const rows = categories.slice(start, start + perPage).map((c, offset) => ({
    id: `wa-interest:${jobId}:${start + offset}`, title: c.label.slice(0, 24),
  }));
  if (start + perPage < categories.length) rows.push({ id: `wa-page:${jobId}:${page + 1}`, title: 'Mais categorias' });
  return { type: 'list', body: { text: 'Qual categoria de produto você tem interesse?' }, action: { button: 'Escolher categoria', sections: [{ title: 'Produto de interesse', rows }] } };
}

export function serviceWindowOpen(lastInbound: string, now = Date.now()): boolean {
  const age = now - new Date(lastInbound).getTime();
  return Number.isFinite(age) && age >= 0 && age < 24 * 3_600_000;
}
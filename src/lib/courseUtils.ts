import type { PiperunDeal, ProposalItem, EquipKey, SmartopsCourse } from '@/types/courses';

export function slugify(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Normaliza datas para `YYYY-MM-DD`. Aceita ISO ou `DD/MM/YYYY` / `DD-MM-YYYY`.
 * Retorna `null` se o valor for vazio ou inválido (em vez de quebrar a gravação no Postgres).
 */
export function normalizeDateBR(value?: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  // Já está em ISO YYYY-MM-DD (com ou sem hora)
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  // DD/MM/YYYY ou DD-MM-YYYY
  const br = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (br) {
    let [, d, m, y] = br;
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCDate() !== day || dt.getUTCMonth() !== month - 1) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

export function buildCourseTag(title: string, firstDate?: string): string {
  const slug = slugify(title).toUpperCase().replace(/-/g, '_');
  return `TREIN_${slug}_${(firstDate ?? 'YYYY-MM-DD').substring(0, 10)}`;
}

export function isDealGanho(deal: PiperunDeal): boolean {
  return deal.status?.toLowerCase() === 'ganha';
}

// CRITICO: nunca usar deal_items — usa piperun_deals_history
export function extractProposalItems(
  deal: PiperunDeal,
  parsedCategories: Record<string, string> = {},
  dealLabel?: string
): ProposalItem[] {
  const items: ProposalItem[] = [];
  let globalIdx = 0;
  const ref = dealLabel || deal.deal_title || deal.deal_id || '';
  for (const proposal of deal.proposals ?? []) {
    for (let idx = 0; idx < (proposal.items ?? []).length; idx++) {
      const it = proposal.items[idx];
      if (!it?.nome) continue;
      const category = parsedCategories[it.nome] ?? inferCategory(it.nome);
      items.push({
        proposal_id: String(proposal.id), item_idx: idx,
        sku: it.sku ?? it.item_id ?? '', nome: it.nome,
        qtd: Number(it.qtd) || 1, unit: Number(it.unit) || 0, total: Number(it.total) || 0,
        equip_key: categoryToEquipKey(category, globalIdx),
        deal_ref: ref,
      });
      globalIdx++;
    }
  }
  return items;
}

function inferCategory(nome: string): string {
  const n = nome.toLowerCase();
  if (/scanner|intraoral|trios|medit|itero/.test(n))            return 'scanner';
  if (/notebook|laptop|dell|lenovo/.test(n))                    return 'notebook';
  if (/exocad|licen|cad|smartmake/.test(n))                     return 'cad';
  if (/impressora|printer|mars|photon|elegoo|formlabs/.test(n)) return 'impressora';
  if (/wash|cure|lavadora|curadora|mercury/.test(n))            return 'pos_impressao';
  if (/fresadora|milling|dgshape/.test(n))                      return 'fresadora';
  if (/forno|sinteri|autoclave|compressor|fotopolimeriz/.test(n)) return 'acessorio';
  return 'outro';
}

export function categoryToEquipKey(category: string, itemIndex?: number): EquipKey | null {
  const map: Record<string, EquipKey> = {
    scanner: 'equip_scanner', notebook: 'equip_notebook', cad: 'equip_cad',
    impressora: 'equip_impressora', pos_impressao: 'equip_pos_impressao',
    fresadora: 'equip_fresadora',
  };
  if (map[category]) return map[category];
  // For uncategorized or 'acessorio'/'outro', return a dynamic key using item index
  if (itemIndex !== undefined) return `equip_outro_${itemIndex}` as EquipKey;
  return null;
}

export function formatDatePtBr(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day} de ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+m-1]} de ${y}`;
}

export function formatWeekday(d: string): string {
  if (!d) return '';
  return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(d + 'T12:00:00').getDay()];
}

export function formatDuration(course: SmartopsCourse): string {
  const d = course.duration_days ?? 1;
  const h = course.duration_hours_per_day;
  if (d === 1) return h ? `${h}h` : '1 dia';
  return h ? `${d} dias (${h}h/dia)` : `${d} dias`;
}

export function resolveLocal(c: Pick<SmartopsCourse, 'modality'|'location'|'meeting_link'>): string {
  if (c.modality === 'presencial') return c.location || 'Local a confirmar';
  if (c.meeting_link) return `Link: ${c.meeting_link}`;
  return 'Online — link será enviado em breve';
}

export function formatPhoneWaleads(raw?: string): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '').replace(/^0/, '');
  const w = d.startsWith('55') ? d : `55${d}`;
  return w.length >= 12 ? w : null;
}

export const MODALITY_CONFIG = {
  presencial:     { label: 'Presencial',     badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  online_ao_vivo: { label: 'Online ao Vivo', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  online:         { label: 'Online',         badge: 'bg-red-700 text-black dark:bg-red-800 dark:text-black' },
  acesso_remoto:  { label: 'Acesso Remoto',  badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
} as const;

export const STATUS_CONFIG = {
  agendado:   { label: 'Agendado',   badge: 'bg-blue-100 text-blue-800' },
  confirmado: { label: 'Confirmado', badge: 'bg-purple-100 text-purple-800' },
  presente:   { label: 'Presente',   badge: 'bg-green-100 text-green-800' },
  ausente:    { label: 'Ausente',    badge: 'bg-red-100 text-red-800' },
  cancelado:  { label: 'Cancelado',  badge: 'bg-gray-100 text-gray-600' },
} as const;

export const EQUIP_CONFIG: Record<EquipKey, {
  label: string; etapa: string; etapa_number: number;
  serial_label: string; serial_placeholder: string;
  lia_serial_field: string; lia_model_field: string; lia_date_field: string | null;
  pode_ser_bancada?: boolean;
}> = {
  equip_scanner:         { label: 'Scanner Intraoral',  etapa: '1 — Captura Digital', etapa_number: 1, serial_label: 'Nº de série',          serial_placeholder: 'Ex: I600-BR-2024-001',  lia_serial_field: 'equip_scanner_serial',         lia_model_field: 'equip_scanner',         lia_date_field: 'equip_scanner_ativacao',         pode_ser_bancada: true },
  equip_scanner_bancada: { label: 'Scanner de Bancada', etapa: '1 — Captura Digital', etapa_number: 1, serial_label: 'Nº de série',          serial_placeholder: 'Ex: MEDIT-2024-001',    lia_serial_field: 'equip_scanner_bancada_serial', lia_model_field: 'equip_scanner_bancada', lia_date_field: 'equip_scanner_bancada_ativacao' },
  equip_notebook:        { label: 'Notebook',           etapa: '1 — Captura Digital', etapa_number: 1, serial_label: 'Service tag / serial', serial_placeholder: 'Ex: ABC1234',           lia_serial_field: 'equip_notebook_serial',        lia_model_field: 'equip_notebook',        lia_date_field: 'equip_notebook_ativacao' },
  equip_cad:             { label: 'Software CAD',       etapa: '2 — CAD',             etapa_number: 2, serial_label: 'Chave / licença',      serial_placeholder: 'Ex: EXOCAD-XXXX-XXXX', lia_serial_field: 'equip_cad_serial',             lia_model_field: 'equip_cad',             lia_date_field: null },
  equip_impressora:      { label: 'Impressora 3D',      etapa: '3 — Impressão 3D',    etapa_number: 3, serial_label: 'Nº de série',          serial_placeholder: 'Ex: MARS5-0042',        lia_serial_field: 'equip_impressora_serial',      lia_model_field: 'equip_impressora',      lia_date_field: 'equip_impressora_ativacao' },
  equip_pos_impressao:   { label: 'Pós-Impressão',      etapa: '4 — Pós-Impressão',   etapa_number: 4, serial_label: 'Nº de série',          serial_placeholder: 'Ex: MV2-0007',          lia_serial_field: 'equip_pos_impressao_serial',   lia_model_field: 'equip_pos_impressao',   lia_date_field: 'equip_pos_impressao_ativacao' },
  equip_fresadora:       { label: 'Fresadora',          etapa: '7 — Fresagem',        etapa_number: 7, serial_label: 'Nº de série',          serial_placeholder: 'Ex: ZIRCON-2024-001',   lia_serial_field: 'equip_fresadora_serial',       lia_model_field: 'equip_fresadora',       lia_date_field: 'equip_fresadora_ativacao' },
};

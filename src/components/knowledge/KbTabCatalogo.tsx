import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCardTranslations } from '@/hooks/useCardTranslations';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbChips, { KbChipOption } from './KbChips';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import { CATALOG_COLORS } from './kbCategoryColors';
import KbResinSheetDialog from './KbResinSheetDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import KbResinDocsDialog, { ResinDocItem } from './KbResinDocsDialog';
import { CAT_ALIASES, CHIP_KEYS, CATEGORIES_WITHOUT_SUBFILTER, normCat } from './kbCategoryTaxonomy';
import { translatePrintType } from '@/lib/dentalTaxonomy';

const SPECIAL = /\b(FDA|ANVISA|NOVO|LANÇAMENTO|KIT|KOL)\b/i;

// Strip HTML tags + decode basic entities + collapse whitespace.
// Used to clean e-commerce-origin descriptions before rendering as plain text.
function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input);
  // remove style/script blocks entirely
  s = s.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ');
  // tags → space
  s = s.replace(/<[^>]+>/g, ' ');
  // common entities
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // numeric entities
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

interface CatalogRow {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  product_category: string | null;
  product_subcategory: string | null;
  cta_1_label: string | null;
  cta_1_url: string | null;
  cta_2_label: string | null;
  cta_2_url: string | null;
  technical_specs: any | null;
}

interface DocLinks {
  id?: string | null;
  datasheet_url: string | null;
  manual_url: string | null;
  spec_sheet_url: string | null;
  technical_specifications: any | null;
  technical_specifications_en?: any | null;
  technical_specifications_es?: any | null;
}

interface CatalogDoc {
  name: string;
  url: string;
  kind: 'FDS' | 'IFU' | 'GUIA' | 'PERFIL' | 'DOC';
}

interface ProductShortLinks {
  landingUrl: string | null;
  formUrl: string | null;
}

const classifyDoc = (n: string): CatalogDoc['kind'] => {
  const u = n.toUpperCase();
  if (u.includes('FDS')) return 'FDS';
  if (u.includes('IFU')) return 'IFU';
  if (u.includes('GUIA')) return 'GUIA';
  if (u.includes('PERFIL') || u.includes('CARACTER')) return 'PERFIL';
  return 'DOC';
};
const docIcon = (k: CatalogDoc['kind']) =>
  k === 'FDS' ? '📄' : k === 'IFU' ? '📘' : k === 'GUIA' ? '📗' : k === 'PERFIL' ? '📋' : '📎';

type ResinDocKind = 'FDS' | 'IFU' | 'GUIA' | 'PERFIL' | 'CERT' | 'LAUDO' | 'APRES' | 'MSDS' | 'DOC';
interface ResinDoc { name: string; url: string; kind: ResinDocKind; category: string | null; }
interface ResinPresentation {
  label: string;
  price: number | null;
  print_type: string | null;
  grams_per_print: number | null;
  prints_per_bottle: number | null;
}

interface SpecRow { label: string; value: string; items?: string[] }

type SpecLang = 'pt' | 'en' | 'es';

const SPEC_LABELS: Record<SpecLang, Record<string, string>> = {
  pt: {
    tipo: 'Tipo',
    carga_por_peso: 'Carga por Peso',
    carga_por_volume: 'Carga por Volume',
    resistencia_flexural_mpa: 'Resistência Flexural (MPa)',
    resistencia_flexural_source: 'Fonte / Certificação',
    modulo_flexural_gpa: 'Módulo Flexural (GPa)',
    dureza_shore_d: 'Dureza Shore D',
    sorcao_agua: 'Sorção de Água',
    radiopacidade: 'Radiopacidade',
    carga_inorganica: 'Carga Inorgânica',
    compatibilidade_camada: 'Compatibilidade de Camada',
    luz_uv_cura: 'Luz UV para Cura',
    resin_class: 'Classe da Resina',
    fda_510k: 'Certificação FDA 510(k)',
    wavelength_nm: 'Comprimento de Onda (nm)',
    ceramic_dominant: 'Dominância Cerâmica',
    vickers_hardness: 'Dureza Vickers',
    inorganic_load_pct: 'Carga Inorgânica (%)',
    flexural_strength_mpa: 'Resistência à Flexão (MPa)',
    flexural_strength_source: 'Fonte / Certificação',
    aplicacoes_definitivas: 'Aplicações Definitivas',
    comprovacao_clinica: 'Comprovação Clínica',
    resina_permanente: 'Resina Permanente',
  },
  en: {
    tipo: 'Type',
    carga_por_peso: 'Filler by Weight',
    carga_por_volume: 'Filler by Volume',
    resistencia_flexural_mpa: 'Flexural Strength (MPa)',
    resistencia_flexural_source: 'Source / Certification',
    modulo_flexural_gpa: 'Flexural Modulus (GPa)',
    dureza_shore_d: 'Shore D Hardness',
    sorcao_agua: 'Water Sorption',
    radiopacidade: 'Radiopacity',
    carga_inorganica: 'Inorganic Filler',
    compatibilidade_camada: 'Layer Compatibility',
    luz_uv_cura: 'UV Curing Light',
    resin_class: 'Resin Class',
    fda_510k: 'FDA 510(k) Clearance',
    wavelength_nm: 'Wavelength (nm)',
    ceramic_dominant: 'Ceramic Dominant',
    vickers_hardness: 'Vickers Hardness',
    inorganic_load_pct: 'Inorganic Filler (%)',
    flexural_strength_mpa: 'Flexural Strength (MPa)',
    flexural_strength_source: 'Source / Certification',
    aplicacoes_definitivas: 'Definitive Applications',
    comprovacao_clinica: 'Clinical Evidence',
    resina_permanente: 'Permanent Resin',
  },
  es: {
    tipo: 'Tipo',
    carga_por_peso: 'Carga por Peso',
    carga_por_volume: 'Carga por Volumen',
    resistencia_flexural_mpa: 'Resistencia a la Flexión (MPa)',
    resistencia_flexural_source: 'Fuente / Certificación',
    modulo_flexural_gpa: 'Módulo Flexural (GPa)',
    dureza_shore_d: 'Dureza Shore D',
    sorcao_agua: 'Sorción de Agua',
    radiopacidade: 'Radiopacidad',
    carga_inorganica: 'Carga Inorgánica',
    compatibilidade_camada: 'Compatibilidad de Capa',
    luz_uv_cura: 'Luz UV para Curado',
    resin_class: 'Clase de Resina',
    fda_510k: 'Certificación FDA 510(k)',
    wavelength_nm: 'Longitud de Onda (nm)',
    ceramic_dominant: 'Dominancia Cerámica',
    vickers_hardness: 'Dureza Vickers',
    inorganic_load_pct: 'Carga Inorgánica (%)',
    flexural_strength_mpa: 'Resistencia a la Flexión (MPa)',
    flexural_strength_source: 'Fuente / Certificación',
    aplicacoes_definitivas: 'Aplicaciones Definitivas',
    comprovacao_clinica: 'Comprobación Clínica',
    resina_permanente: 'Resina Permanente',
  },
};

const BOOL_LABELS: Record<SpecLang, { yes: string; no: string }> = {
  pt: { yes: 'Sim', no: 'Não' },
  en: { yes: 'Yes', no: 'No' },
  es: { yes: 'Sí',  no: 'No' },
};

const prettifyKey = (k: string) =>
  k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const translateSpecLabel = (raw: string, lang: SpecLang): string => {
  const norm = raw.trim().toLowerCase();
  if (SPEC_LABELS[lang][norm]) return SPEC_LABELS[lang][norm];
  if (/^[a-z0-9_]+$/.test(raw)) return prettifyKey(raw);
  return raw;
};

// Normaliza qualquer formato (array de {label,value}, array de {key,value},
// objeto plano {chave: valor}, string JSON) em uma lista [{label,value}].
function normalizeSpecs(raw: any, lang: SpecLang = 'pt'): SpecRow[] {
  if (raw == null) return [];
  let v: any = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return []; }
  }
  const out: SpecRow[] = [];
  const pushPair = (label: any, value: any) => {
    const rawLabel = label == null ? '' : String(label).trim();
    if (!rawLabel) return;
    const l = translateSpecLabel(rawLabel, lang);
    if (value === null || value === undefined) return;
    if (typeof value === 'boolean') {
      out.push({ label: l, value: value ? BOOL_LABELS[lang].yes : BOOL_LABELS[lang].no });
      return;
    }
    if (Array.isArray(value)) {
      const items = value
        .filter((it) => it !== null && it !== undefined && String(it).trim() !== '')
        .map((it) => (typeof it === 'object' ? JSON.stringify(it) : String(it)).trim());
      if (items.length === 0) return;
      out.push({ label: l, value: items.join(', '), items });
      return;
    }
    if (typeof value === 'number') {
      out.push({ label: l, value: String(value) });
      return;
    }
    const valStr = (typeof value === 'object' ? JSON.stringify(value) : String(value)).trim();
    if (!valStr) return;
    out.push({ label: l, value: valStr });
  };
  if (Array.isArray(v)) {
    v.forEach((item) => {
      if (item && typeof item === 'object') {
        const label = (item as any).label ?? (item as any).key ?? (item as any).name ?? (item as any).campo;
        const value = (item as any).value ?? (item as any).valor ?? (item as any).val;
        if (label !== undefined || value !== undefined) pushPair(label, value);
        else Object.entries(item).forEach(([k, val]) => pushPair(k, val));
      }
    });
  } else if (typeof v === 'object') {
    Object.entries(v).forEach(([k, val]) => pushPair(k, val));
  }
  // remove duplicatas (mesmo label+value)
  const seen = new Set<string>();
  return out.filter((r) => {
    const key = `${r.label.toLowerCase()}|${r.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const classifyResinDoc = (name: string, category: string | null): ResinDocKind => {
  const u = (name + ' ' + (category || '')).toUpperCase();
  if (u.includes('FDS') || u.includes('MSDS') || u.includes('SEGURANÇA') || u.includes('SEGURANCA')) return 'FDS';
  if (u.includes('IFU') || u.includes('INSTRU')) return 'IFU';
  if (u.includes('CERTIFIC')) return 'CERT';
  if (u.includes('LAUDO') || u.includes('RELATO')) return 'LAUDO';
  if (u.includes('APRESENT')) return 'APRES';
  if (u.includes('GUIA')) return 'GUIA';
  if (u.includes('PERFIL') || u.includes('CARACTER')) return 'PERFIL';
  return 'DOC';
};

const CATEGORY_I18N_KEY: Record<string, string> = {
  'RESINAS 3D': 'kb.chips.resinas',
  'PÓS-IMPRESSÃO': 'kb.chips.pos_impressao',
  'POS-IMPRESSAO': 'kb.chips.pos_impressao',
  'CARACTERIZAÇÃO': 'kb.chips.caracterizacao',
  'CARACTERIZACAO': 'kb.chips.caracterizacao',
  'DENTÍSTICA, ESTÉTICA E ORTODONTIA': 'kb.chips.dentistica',
  'DENTISTICA, ESTETICA E ORTODONTIA': 'kb.chips.dentistica',
  'SOFTWARES': 'kb.chips.softwares',
  'SCANNERS 3D': 'kb.chips.scanners',
  'IMPRESSÃO 3D': 'kb.chips.impressao',
  'IMPRESSAO 3D': 'kb.chips.impressao',
};
const categoryLabel = (canon: string, t: (k: string) => string): string => {
  const key = CATEGORY_I18N_KEY[canon];
  if (!key) return canon;
  const translated = t(key);
  return translated && translated !== key ? translated : canon;
};
const resinDocIcon = (k: ResinDocKind) =>
  k === 'FDS' ? '📄' : k === 'IFU' ? '📘' : k === 'GUIA' ? '📗' : k === 'PERFIL' ? '📋'
  : k === 'CERT' ? '🏅' : k === 'LAUDO' ? '🧪' : k === 'APRES' ? '🎯' : k === 'MSDS' ? '⚠️' : '📎';
const resinDocShort = (d: ResinDoc, t?: (key: string) => string): string => {
  switch (d.kind) {
    case 'FDS': return 'FDS';
    case 'IFU': return 'IFU';
    case 'GUIA': return t ? t('kb.catalogo.doc_kind.guia') : 'Guia';
    case 'PERFIL': return t ? t('kb.catalogo.doc_kind.perfil') : 'Perfil';
    case 'CERT': return t ? t('kb.catalogo.doc_kind.certificado') : 'Certificado';
    case 'LAUDO': return t ? t('kb.catalogo.doc_kind.laudo') : 'Laudo';
    case 'APRES': return t ? t('kb.catalogo.doc_kind.apresentacao') : 'Apresentação';
    case 'MSDS': return 'MSDS';
    default: return d.name.length > 22 ? d.name.slice(0, 20) + '…' : d.name;
  }
};
const formatBRL = (v: number | null): string => {
  if (v == null || !isFinite(v)) return '';
  try { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  catch { return `R$ ${v.toFixed(2)}`; }
};

interface ResinInfo {
  id: string;
  slug: string;
  name: string;
  cta_1_label: string | null;
  cta_1_url: string | null;
  cta_2_label: string | null;
  cta_2_url: string | null;
  cta_3_label: string | null;
  cta_3_url: string | null;
  cta_4_label: string | null;
  cta_4_url: string | null;
  processing_instructions: string | null;
  image_url: string | null;
  technical_specs: any | null;
  technical_specs_en?: any | null;
  technical_specs_es?: any | null;
}

// Build a stable fuzzy key for matching catalog products to resin records.
// Strips accents/punctuation and removes common stopwords like "resina", "3d",
// "smart", "print", "modelo/model", "bio", so e.g.
//   "Resina 3D Smart Print Bio Bite Splint +Flex"  ->  "bite|flex|splint"
//   "Smart Print Bio Bite Splint +Flex"            ->  "bite|flex|splint"
const RESIN_STOPWORDS = new Set([
  'resina', 'resin', '3d', 'smart', 'print', 'bio',
  'modelo', 'model', 'de', 'da', 'do', 'a', 'o',
  // Color/qualifier tokens that sometimes appear only on one side
  'rosa', 'branca', 'branco', 'clear', 'translucida', 'translucido',
  'transparente', 'salmao',
  // Generic dental/clinical tokens that produce false subset matches across
  // unrelated categories (e.g. "Try-in" cement vs "Try-in Calcinável" resin).
  'try', 'in', 'try-in', 'tryin',
]);
const resinKey = (raw: string): string => {
  if (!raw) return '';
  const cleaned = raw
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    // Collapse apostrophes/quotes against neighbour letters so "L'Aqua" → "laqua"
    // (matching the catalog's accent-stripped "Láqua" → "laqua").
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9+\s]/g, ' ') // keep + (for "+Flex"), drop other punctuation
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned
    .split(' ')
    .filter((t) => t && t.length > 1 && !RESIN_STOPWORDS.has(t));
  return Array.from(new Set(tokens)).sort().join('|');
};

// Subset/superset fallback: matches when one side's significant tokens are
// fully contained in the other (and at least 2 tokens overlap, or the smaller
// side has a single highly-specific token).
const findResinBySubset = (
  map: Map<string, ResinInfo>,
  catalogName: string,
): ResinInfo | undefined => {
  const cat = resinKey(catalogName);
  if (!cat) return undefined;
  const catTokens = new Set(cat.split('|').filter(Boolean));
  if (catTokens.size === 0) return undefined;
  let best: { info: ResinInfo; overlap: number } | null = null;
  for (const [k, info] of map.entries()) {
    if (!k.startsWith('fk:')) continue;
    const rTokens = new Set(k.slice(3).split('|').filter(Boolean));
    if (rTokens.size === 0) continue;
    let overlap = 0;
    for (const t of catTokens) if (rTokens.has(t)) overlap++;
    const smaller = Math.min(catTokens.size, rTokens.size);
    const ok = overlap >= 2 || (smaller === 1 && overlap === 1);
    if (!ok) continue;
    if (!best || overlap > best.overlap) best = { info, overlap };
  }
  return best?.info;
};

export default function KbTabCatalogo() {
  const { t, language } = useLanguage();
  const specLang: SpecLang = (language === 'en' || language === 'es') ? language : 'pt';
  const [docs, setDocs] = useState<Map<string, DocLinks>>(new Map());
  const [extraDocs, setExtraDocs] = useState<Map<string, CatalogDoc[]>>(new Map());
  const [rowsRaw, setRowsRaw] = useState<any[]>([]);
  const [resinsRaw, setResinsRaw] = useState<any[]>([]);
  const [resinDocs, setResinDocs] = useState<Map<string, ResinDoc[]>>(new Map());
  const [resinPres, setResinPres] = useState<Map<string, ResinPresentation[]>>(new Map());
  const [productShortLinks, setProductShortLinks] = useState<Map<string, ProductShortLinks>>(new Map());
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState('all');
  const [subChip, setSubChip] = useState('all');
  const [q, setQ] = useState('');
  const [sheetResin, setSheetResin] = useState<string | null>(null);
  const [procResin, setProcResin] = useState<ResinInfo | null>(null);
  const [docsModal, setDocsModal] = useState<{ name: string; docs: ResinDocItem[] } | null>(null);
  const [specsModal, setSpecsModal] = useState<{ name: string; raw: any } | null>(null);
  const specsModalRows = useMemo<SpecRow[]>(
    () => (specsModal ? normalizeSpecs(specsModal.raw, specLang) : []),
    [specsModal, specLang]
  );

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      const [
        { data: cat, error: e1 },
        { data: pc, error: e2 },
        { data: rs, error: e3 },
        { data: cd, error: e4 },
        { data: rd, error: e5 },
        { data: rp, error: e6 },
        { data: forms, error: e7 },
        { data: shortLinks, error: e8 },
      ] = await Promise.all([
        supabase
          .from('system_a_catalog')
          .select('id, name, name_en, name_es, slug, description, description_en, description_es, image_url, product_category, product_category_en, product_category_es, product_subcategory, product_subcategory_en, product_subcategory_es, cta_1_label, cta_1_label_en, cta_1_label_es, cta_1_url, cta_2_label, cta_2_label_en, cta_2_label_es, cta_2_url, technical_specs, technical_specs_en, technical_specs_es, extra_data')
          .eq('active', true)
          .eq('approved', true)
          .eq('visible_in_ui', true)
          .not('product_category', 'is', null)
          .order('product_category')
          .order('display_order')
          .order('name')
          .limit(500),
        supabase
          .from('products_catalog')
          .select('product_id, name, datasheet_url, manual_url, spec_sheet_url, technical_specifications, technical_specifications_en, technical_specifications_es')
          .limit(1000),
        supabase
          .from('resins')
          .select('id, name, name_en, name_es, slug, image_url, cta_1_label, cta_1_label_en, cta_1_label_es, cta_1_url, cta_2_label, cta_2_label_en, cta_2_label_es, cta_2_url, cta_3_label, cta_3_label_en, cta_3_label_es, cta_3_url, cta_4_label, cta_4_label_en, cta_4_label_es, cta_4_url, processing_instructions, processing_instructions_en, processing_instructions_es, technical_specs, technical_specs_en, technical_specs_es')
          .eq('active', true)
          .limit(500),
        supabase
          .from('catalog_documents')
          .select('product_id, document_name, file_url, order_index')
          .eq('active', true)
          .order('order_index')
          .limit(1000),
        supabase
          .from('resin_documents')
          .select('resin_id, document_name, file_url, document_category, order_index')
          .eq('active', true)
          .order('order_index')
          .limit(2000),
        supabase
          .from('resin_presentations')
          .select('resin_id, label, price, print_type, grams_per_print, prints_per_bottle, sort_order')
          .order('sort_order')
          .limit(2000),
        supabase
          .from('smartops_forms')
          .select('slug, product_catalog_id')
          .not('product_catalog_id', 'is', null)
          .eq('active', true)
          .limit(1000),
        supabase
          .from('smartops_short_links')
          .select('short_code, form_slug, default_target')
          .limit(2000),
      ]);
      if (cancel) return;
      if (e1) console.error(e1);
      if (e2) console.error(e2);
      if (e3) console.error(e3);
      if (e4) console.error(e4);
      if (e5) console.error(e5);
      if (e6) console.error(e6);
      if (e7) console.error(e7);
      if (e8) console.error(e8);
      const docMap = new Map<string, DocLinks>();
      (pc || []).forEach((p: any) => {
        if (!p?.name) return;
        docMap.set(p.name.toLowerCase().trim(), {
          id: p.product_id || null,
          datasheet_url: p.datasheet_url,
          manual_url: p.manual_url,
          spec_sheet_url: p.spec_sheet_url,
          technical_specifications: p.technical_specifications ?? null,
          technical_specifications_en: p.technical_specifications_en ?? null,
          technical_specifications_es: p.technical_specifications_es ?? null,
        });
      });
      const shortByForm = new Map<string, ProductShortLinks>();
      const shortBase = 'https://s.smartdent.com.br';
      (shortLinks || []).forEach((link: any) => {
        if (!link?.form_slug || !link?.short_code) return;
        const current = shortByForm.get(link.form_slug) || { landingUrl: null, formUrl: null };
        const url = `${shortBase}/${link.short_code}`;
        if (link.default_target === 'landing_page') current.landingUrl = url;
        if (link.default_target === 'form') current.formUrl = url;
        shortByForm.set(link.form_slug, current);
      });
      const shortByProduct = new Map<string, ProductShortLinks>();
      (forms || []).forEach((form: any) => {
        if (!form?.product_catalog_id || !form?.slug) return;
        const links = shortByForm.get(form.slug);
        if (!links?.landingUrl && !links?.formUrl) return;
        const current = shortByProduct.get(form.product_catalog_id) || { landingUrl: null, formUrl: null };
        shortByProduct.set(form.product_catalog_id, {
          landingUrl: current.landingUrl || links.landingUrl,
          formUrl: current.formUrl || links.formUrl,
        });
      });
      const extraMap = new Map<string, CatalogDoc[]>();
      (cd || []).forEach((d: any) => {
        if (!d?.product_id || !d?.file_url) return;
        const name = (d.document_name || 'Documento').trim();
        const list = extraMap.get(d.product_id) || [];
        list.push({ name, url: d.file_url, kind: classifyDoc(name) });
        extraMap.set(d.product_id, list);
      });
      setExtraDocs(extraMap);
      setResinsRaw((rs || []) as any[]);
      const rdMap = new Map<string, ResinDoc[]>();
      (rd || []).forEach((d: any) => {
        if (!d?.resin_id || !d?.file_url) return;
        const name = (d.document_name || 'Documento').trim();
        const list = rdMap.get(d.resin_id) || [];
        list.push({ name, url: d.file_url, category: d.document_category || null, kind: classifyResinDoc(name, d.document_category) });
        rdMap.set(d.resin_id, list);
      });
      setResinDocs(rdMap);
      setProductShortLinks(shortByProduct);
      const rpMap = new Map<string, ResinPresentation[]>();
      (rp || []).forEach((p: any) => {
        if (!p?.resin_id) return;
        const label = p.label ? String(p.label).trim() : '';
        const gpp = p.grams_per_print != null ? Number(p.grams_per_print) : null;
        const ppb = p.prints_per_bottle != null ? Number(p.prints_per_bottle) : null;
        const ptype = p.print_type ? String(p.print_type).trim() : '';
        // Discard empty rows
        if (!label && !ptype && !gpp && !ppb) return;
        const list = rpMap.get(p.resin_id) || [];
        list.push({
          label,
          price: typeof p.price === 'number' ? p.price : (p.price ? Number(p.price) : null),
          print_type: ptype || null,
          grams_per_print: gpp,
          prints_per_bottle: ppb,
        });
        rpMap.set(p.resin_id, list);
      });
      setResinPres(rpMap);
      setDocs(docMap);
      setRowsRaw((cat || []) as any[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  // On-demand translation for products + resins (PT → EN/ES).
  // Pre-fill `technical_specs` a partir de `extra_data.system_a_live.technical_specs`
  // quando o top-level está vazio (caso de produtos enriquecidos via planilha /
  // editor manual). Sem isso, useCardTranslations não detecta PT presente e
  // nunca dispara translate-card-row, deixando a Tabela técnica em PT em /en e /es.
  const rowsForTr = useMemo(() => {
    return (rowsRaw || []).map((r: any) => {
      const top = r?.technical_specs;
      const hasTop = Array.isArray(top) ? top.length > 0 : (top != null);
      if (hasTop) return r;
      const live = r?.extra_data?.system_a_live?.technical_specs;
      if (Array.isArray(live) && live.length > 0) {
        return { ...r, technical_specs: live };
      }
      return r;
    });
  }, [rowsRaw]);
  const translatedRows = useCardTranslations(
    'system_a_catalog',
    rowsForTr,
    // NÃO traduzir product_category/product_subcategory: o filtro depende do valor PT canônico
    // (normCat). Chips já traduzem via t() em CHIP_KEYS.
    ['name', 'description', 'cta_1_label', 'cta_2_label', 'technical_specs']
  );
  const translatedResins = useCardTranslations(
    'resins',
    resinsRaw,
    ['name', 'processing_instructions', 'cta_1_label', 'cta_2_label', 'cta_3_label', 'cta_4_label', 'technical_specs']
  );
  // products_catalog technical_specifications: dispara tradução on-demand e
  // espelha as colunas _en/_es de volta no Map `docs` para a leitura no card.
  const pcRowsForTr = useMemo(() => {
    const out: any[] = [];
    docs.forEach((v) => {
      if (!v?.id) return;
      if (!v.technical_specifications) return;
      out.push({
        id: v.id,
        technical_specifications: v.technical_specifications,
        technical_specifications_en: v.technical_specifications_en ?? null,
        technical_specifications_es: v.technical_specifications_es ?? null,
      });
    });
    return out;
  }, [docs]);
  const translatedPc = useCardTranslations(
    'products_catalog',
    pcRowsForTr,
    ['technical_specifications']
  );
  const pcTrById = useMemo(() => {
    const m = new Map<string, any>();
    (translatedPc || []).forEach((r: any) => {
      if (r?.id) m.set(r.id, r);
    });
    return m;
  }, [translatedPc]);
  const rows = translatedRows as CatalogRow[];
  const resins = useMemo(() => {
    const m = new Map<string, ResinInfo>();
    (translatedResins || []).forEach((r: any) => {
      if (!r?.name || !r?.slug || !r?.id) return;
      const info: ResinInfo = {
        id: r.id, slug: r.slug, name: r.name,
        cta_1_label: r.cta_1_label, cta_1_url: r.cta_1_url,
        cta_2_label: r.cta_2_label, cta_2_url: r.cta_2_url,
        cta_3_label: r.cta_3_label, cta_3_url: r.cta_3_url,
        cta_4_label: r.cta_4_label, cta_4_url: r.cta_4_url,
        processing_instructions: r.processing_instructions || null,
        image_url: r.image_url || null,
        technical_specs: r.technical_specs ?? null,
        technical_specs_en: r.technical_specs_en ?? null,
        technical_specs_es: r.technical_specs_es ?? null,
      };
      m.set(String(r.name).toLowerCase().trim(), info);
      const fk = resinKey(r.name);
      if (fk) m.set('fk:' + fk, info);
      if (r.slug) m.set('slug:' + String(r.slug).toLowerCase().trim(), info);
    });
    return m;
  }, [translatedResins]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const canon = normCat(r.product_category);
      if (!canon) return false;
      if (chip !== 'all' && canon !== chip) return false;
      if (chip !== 'all' && subChip !== 'all' && !CATEGORIES_WITHOUT_SUBFILTER.has(chip)) {
        if ((r.product_subcategory || '').trim() !== subChip) return false;
      }
      if (term && !(r.name?.toLowerCase().includes(term) || stripHtml(r.description).toLowerCase().includes(term))) return false;
      return true;
    });
  }, [rows, q, chip, subChip]);

  // Subcategorias derivadas da categoria ativa (distinct, ordenadas)
  const subChips: KbChipOption[] = useMemo(() => {
    if (chip === 'all' || CATEGORIES_WITHOUT_SUBFILTER.has(chip)) return [];
    const set = new Set<string>();
    rows.forEach((r) => {
      if (normCat(r.product_category) !== chip) return;
      const s = (r.product_subcategory || '').trim();
      if (s) set.add(s);
    });
    if (set.size === 0) return [];
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return [{ key: 'all', label: t('kb.chips.all') }, ...list.map((s) => ({ key: s, label: s }))];
  }, [rows, chip, t]);

  // Reset subChip quando a categoria muda
  useEffect(() => { setSubChip('all'); }, [chip]);

  const chips: KbChipOption[] = CHIP_KEYS.map((c) => ({ key: c.key, label: t(c.tk) }));
  return (
    <section>
      <KbSectionHeader title={t('kb.catalogo.title')} subtitle={t('kb.catalogo.subtitle')} />
      <KbSearchBar placeholder={t('kb.catalogo.search')} value={q} onDebouncedChange={setQ} />
      <KbChips options={chips} active={chip} onChange={setChip} />
      {subChips.length > 1 && (
        <KbChips options={subChips} active={subChip} onChange={setSubChip} />
      )}
      {!loading && <KbResultCount count={filtered.length} noun="product" />}
      <div className="kb-grid">
        {loading ? (
          <KbSkeletonGrid />
        ) : filtered.length === 0 ? (
          <KbEmptyState icon="📦" />
        ) : (
          filtered.map((p, i) => {
            const canon = normCat(p.product_category) || 'SOFTWARES';
            const color = CATALOG_COLORS[canon] || '#5F6368';
            const bgBadge = color + '1A';
            const special = p.product_subcategory && SPECIAL.test(p.product_subcategory)
              ? p.product_subcategory.match(SPECIAL)![0].toUpperCase()
              : null;
            const d = docs.get(p.name.toLowerCase().trim());
            // Only attempt resin lookup when this catalog item is itself a resin.
            // Otherwise unrelated categories (Cimentos, Caracterização, etc.) inherit
            // resin image/CTAs/processing instructions via fuzzy token overlap.
            const isResinCategory = canon === 'RESINAS 3D';
            // High-confidence match only (exact name, exact slug, exact resinKey).
            // Subset fallback is reserved for image/CTAs — never for technical specs,
            // to avoid bleeding specs from an unrelated resin into a card.
            const resinExact = isResinCategory
              ? (
                  resins.get(p.name.toLowerCase().trim()) ||
                  (p.slug ? resins.get('slug:' + String(p.slug).toLowerCase().trim()) : undefined) ||
                  resins.get('fk:' + resinKey(p.name))
                )
              : undefined;
            const resinFuzzy = isResinCategory && !resinExact
              ? findResinBySubset(resins, p.name)
              : undefined;
            const resin = resinExact || resinFuzzy;
            const hasParametrizacao = !!resin;
            const productDocs = extraDocs.get(p.id) || [];
            const shortCtas = productShortLinks.get(p.id);
            const landingShortCtaUrl = shortCtas?.landingUrl || null;
            const formShortCtaUrl = shortCtas?.formUrl || null;
            const hasDocKind = (k: CatalogDoc['kind']) => productDocs.some((x) => x.kind === k);
            const rDocs: ResinDoc[] = resin ? (resinDocs.get(resin.id) || []) : [];
            const rPres: ResinPresentation[] = resin ? (resinPres.get(resin.id) || []) : [];
            // CTAs from resins take precedence (FDS/IFU live there); fall back to catalog/products_catalog
            const lojaUrl = resin?.cta_1_url || p.cta_1_url || null;
            const fdsUrl = rDocs.find((x) => x.kind === 'FDS')?.url
              || resin?.cta_2_url
              || productDocs.find((x) => x.kind === 'FDS')?.url
              || d?.datasheet_url || d?.spec_sheet_url || null;
            const ifuUrl = rDocs.find((x) => x.kind === 'IFU')?.url
              || resin?.cta_3_url
              || productDocs.find((x) => x.kind === 'IFU')?.url
              || d?.manual_url || null;
            // Extra docs (Guia, Perfil/Características, etc.) not already covered by FDS/IFU
            const otherDocs = productDocs.filter((x) => x.kind !== 'FDS' && x.kind !== 'IFU');
            // Resin docs that aren't already surfaced as FDS/IFU
            const usedUrls = new Set<string>([lojaUrl, fdsUrl, ifuUrl].filter(Boolean) as string[]);
            const extraResinDocs = rDocs.filter((x) => x.kind !== 'FDS' && x.kind !== 'IFU' && !usedUrls.has(x.url));
            // Merge ALL extra docs (catalog + resin) into a single list for the modal
            const allExtraDocs: ResinDocItem[] = [
              ...extraResinDocs.map((x) => ({ name: x.name, url: x.url, kind: x.kind as ResinDocItem['kind'] })),
              ...otherDocs
                .filter((x) => !usedUrls.has(x.url))
                .map((x) => ({
                  name: x.name,
                  url: x.url,
                  kind: (x.kind === 'GUIA' ? 'GUIA' : x.kind === 'PERFIL' ? 'PERFIL' : 'DOC') as ResinDocItem['kind'],
                })),
            ];
            // Dedup SKU presentations by label + print_type + prints_per_bottle
            const presDeduped: ResinPresentation[] = Array.from(
              new Map(
                rPres.map((pr) => [`${pr.label}|${pr.print_type || ''}|${pr.prints_per_bottle ?? ''}`, pr])
              ).values()
            );
            const formatPresChip = (pr: ResinPresentation): string => {
              const parts: string[] = [];
              if (pr.label) parts.push(/^\d+(\.\d+)?$/.test(pr.label) ? `${pr.label}g` : pr.label);
              if (pr.print_type) parts.push(translatePrintType(pr.print_type, t));
              if (pr.prints_per_bottle && pr.prints_per_bottle > 0) parts.push(`${pr.prints_per_bottle} imp/frasco`);
              return parts.join(' · ');
            };
            const primaryUrl = lojaUrl || fdsUrl || ifuUrl || otherDocs[0]?.url || null;
            // Specs técnicos: usar APENAS technical_specifications do Sistema A
            // (formato { label, value } em PT). Não usar campos snake_case
            // da tabela `resins` local (resin_class, wavelength_nm, etc.).
            const rawSpecs: any = (() => {
              // Edição manual (admin) tem prioridade absoluta sobre qualquer
              // fonte sincronizada — o que está no editor deve aparecer no card.
              const live = (p as any)?.extra_data?.system_a_live?.technical_specs;
              const manuallyEdited = !!(p as any)?.extra_data?.system_a_live?.manually_edited_at;
              // Translated copies (top-level columns populated on-demand pelo
              // edge function `translate-card-row`, que sabe ler do live).
              const liveTr =
                (specLang === 'en' && (p as any).technical_specs_en) ||
                (specLang === 'es' && (p as any).technical_specs_es) ||
                null;
              const pcTr = d && (d as any).id ? pcTrById.get((d as any).id) : null;
              const docTr =
                (specLang === 'en' && (pcTr?.technical_specifications_en ?? pcTr?.technical_specifications)) ||
                (specLang === 'es' && (pcTr?.technical_specifications_es ?? pcTr?.technical_specifications)) ||
                null;
              if (manuallyEdited) {
                if (liveTr) {
                  const fromTr = normalizeSpecs(liveTr, specLang);
                  if (fromTr.length) return liveTr;
                }
                const fromLive = normalizeSpecs(live, specLang);
                if (fromLive.length) return live;
              }
              if (docTr) {
                const fromDocTr = normalizeSpecs(docTr, specLang);
                if (fromDocTr.length) return docTr;
              }
              const fromDocs = normalizeSpecs(d?.technical_specifications, specLang);
              if (fromDocs.length) return d?.technical_specifications;
              if (liveTr) {
                const fromTr = normalizeSpecs(liveTr, specLang);
                if (fromTr.length) return liveTr;
              }
              const fromLive = normalizeSpecs(live, specLang);
              if (fromLive.length) return live;
              // Fallback: technical_specs da resina vinculada — só em match exato
              // (nome/slug/resinKey). Subset/fuzzy não entra aqui para evitar
              // poluir um card com specs de outra resina.
              if (resinExact) {
                const resinSpecs =
                  (specLang === 'en' && (resinExact as any).technical_specs_en) ||
                  (specLang === 'es' && (resinExact as any).technical_specs_es) ||
                  (resinExact as any).technical_specs;
                const fromResin = normalizeSpecs(resinSpecs, specLang);
                if (fromResin.length) return resinSpecs;
              }
              return null;
            })();
            const specs: SpecRow[] = rawSpecs ? normalizeSpecs(rawSpecs, specLang) : [];
            // Prefer resin image over catalog image when a resin match exists
            const cardImage = resin?.image_url || p.image_url || null;
            const open = (url: string | null) => {
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
            };
            return (
              <article key={p.id} className="kb-card" style={{ animationDelay: `${i * 18}ms` }}>
                {cardImage ? (
                  <img
                    src={cardImage}
                    alt={p.name}
                    loading="lazy"
                    className="kb-cthumb"
                    style={{ cursor: primaryUrl ? 'pointer' : 'default', objectFit: 'contain', background: '#FFFFFF' }}
                    onClick={() => open(primaryUrl)}
                  />
                ) : (
                  <div
                    className="kb-cthumb kb-cthumb-fallback"
                    style={{ background: `linear-gradient(135deg, ${color}CC, ${color}44)`, cursor: primaryUrl ? 'pointer' : 'default' }}
                    onClick={() => open(primaryUrl)}
                    role="button"
                    tabIndex={0}
                  >
                    <span>📦</span>
                  </div>
                )}
                <div className="kb-cbody">
                  <div className="kb-meta">
                    <span className="kb-cat-badge" style={{ background: bgBadge, color }}>•</span>
                    <span className="kb-cat-label" style={{ color }}>{categoryLabel(canon, t)}</span>
                    {special && (
                      <span className="kb-special-badge" style={{ background: '#1A73E810', color: '#1A73E8' }}>{special}</span>
                    )}
                  </div>
                  <h3 className="kb-title">{p.name}</h3>
                  {(p.description || p.product_subcategory) && (
                    <p className="kb-excerpt">{stripHtml(p.description) || p.product_subcategory}</p>
                  )}
                  {(lojaUrl || fdsUrl || ifuUrl || allExtraDocs.length > 0 || landingShortCtaUrl || formShortCtaUrl) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                      {lojaUrl && (
                        <button
                          type="button"
                          className="kb-action-btn"
                          onClick={() => open(lojaUrl)}
                          style={{ background: '#1A73E8', color: '#fff', borderColor: '#1A73E8' }}
                          title={t('kb.catalogo.actions.loja_title')}
                        >
                          {t('kb.catalogo.actions.loja')}
                        </button>
                      )}
                      {fdsUrl && (
                        <button type="button" className="kb-action-btn" onClick={() => open(fdsUrl)} title={t('kb.catalogo.actions.fds_title')}>
                          📄 FDS
                        </button>
                      )}
                      {ifuUrl && (
                        <button type="button" className="kb-action-btn" onClick={() => open(ifuUrl)} title={t('kb.catalogo.actions.ifu_title')}>
                          📘 IFU
                        </button>
                      )}
                      {allExtraDocs.length > 0 && (
                        <button
                          type="button"
                          className="kb-action-btn"
                          onClick={() => setDocsModal({ name: resin?.name || p.name, docs: allExtraDocs })}
                          title={t('kb.catalogo.actions.docs_title')}
                        >
                          {t('kb.catalogo.actions.docs', { count: allExtraDocs.length })}
                        </button>
                      )}
                      {landingShortCtaUrl && (
                        <button type="button" className="kb-action-btn" onClick={() => open(landingShortCtaUrl)} title="Saiba mais">
                          Saiba mais
                        </button>
                      )}
                      {formShortCtaUrl && (
                        <button type="button" className="kb-action-btn" onClick={() => open(formShortCtaUrl)} title="Entre em contato">
                          Entre em contato
                        </button>
                      )}
                      {specs.length > 0 && (
                        <button
                          type="button"
                          className="kb-action-btn"
                          onClick={() => setSpecsModal({ name: resin?.name || p.name, raw: rawSpecs })}
                          title={t('kb.catalogo.actions.specs_title')}
                        >
                          {t('kb.catalogo.actions.specs')}
                        </button>
                      )}
                    </div>
                  )}
                  {presDeduped.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#5F6368', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        {t('kb.catalogo.presentations')}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#202124', tableLayout: 'fixed' }}>
                        <thead>
                          <tr style={{ background: '#F6F8FB', color: '#5F6368' }}>
                            <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #E0E3E7', fontWeight: 600, width: '22%' }}>grs</th>
                            <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #E0E3E7', fontWeight: 600 }}>{t('kb.catalogo.print_type')}</th>
                            <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid #E0E3E7', fontWeight: 600, width: '26%' }}>{t('kb.catalogo.prints_per_bottle')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {presDeduped.map((pr, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #F0F2F5' }}>
                              <td style={{ padding: '4px 6px' }}>{pr.label ? (/^\d+(\.\d+)?$/.test(pr.label) ? `${pr.label}g` : pr.label) : '—'}</td>
                              <td style={{ padding: '4px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={translatePrintType(pr.print_type, t) || ''}>{translatePrintType(pr.print_type, t) || '—'}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pr.prints_per_bottle && pr.prints_per_bottle > 0 ? pr.prints_per_bottle : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {resin?.processing_instructions && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="kb-action-btn"
                        onClick={() => setProcResin(resin)}
                        style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title={t('kb.catalogo.actions.pre_post_title')}
                      >
                        {t('kb.catalogo.actions.pre_post')}
                      </button>
                    </div>
                  )}
                  {hasParametrizacao && (
                    <div style={{ marginTop: 6 }}>
                       <button
                         type="button"
                         className="kb-action-btn"
                         onClick={() => {
                           const params = new URLSearchParams(window.location.search);
                           params.set('tab', 'parametros');
                           window.location.search = params.toString();
                         }}
                         style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                         title={t('kb.catalogo.actions.parametrization_title')}
                       >
                         {t('kb.catalogo.actions.parametrization')}
                       </button>
                    </div>
                  )}
                  <div className="kb-cfoot">
                    <span className="kb-date">Smart Dent</span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
      <KbResinSheetDialog
        open={!!sheetResin}
        onClose={() => setSheetResin(null)}
        resinName={sheetResin}
      />
      <KbResinDocsDialog
        open={!!docsModal}
        onClose={() => setDocsModal(null)}
        resinName={docsModal?.name || null}
        docs={docsModal?.docs || []}
      />
      <Dialog open={!!procResin} onOpenChange={(v) => !v && setProcResin(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('kb.catalogo.dialogs.pre_post', { name: procResin?.name || '' })}</DialogTitle>
          </DialogHeader>
          {procResin?.processing_instructions && (
            <div
              style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: '#202124' }}
            >
              {procResin.processing_instructions}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!specsModal} onOpenChange={(v) => !v && setSpecsModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('kb.catalogo.dialogs.specs', { name: specsModal?.name || '' })}</DialogTitle>
          </DialogHeader>
          {specsModal && specsModalRows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: '#202124' }}>
              <tbody>
                {specsModalRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E0E3E7' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#5F6368', width: '38%', verticalAlign: 'top', background: '#F6F8FB' }}>
                      {row.label}
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                      {row.items && row.items.length > 0 ? (
                        <ul style={{ listStyle: 'disc', paddingLeft: 18, margin: 0 }}>
                          {row.items.map((it, i2) => (<li key={i2}>{it}</li>))}
                        </ul>
                      ) : (
                        row.value
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
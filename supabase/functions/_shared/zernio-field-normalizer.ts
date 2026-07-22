// _shared/zernio-field-normalizer.ts
//
// PADRÃO ÚNICO DO SISTEMA: usado tanto pelo smart-ops-zernio-lead-webhook
// quanto pelo smart-ops-meta-lead-webhook nativo. Nenhum lead do Meta Lead
// Ads deve chegar em lia_attendances/PipeRun sem passar por aqui.

function slugify(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildCanonicalLookup(canonicalList: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of canonicalList) map.set(slugify(c), c);
  return map;
}

// 1. Área de atuação
const AREA_ATUACAO_CANONICAL = [
  "CLÍNICA OU CONSULTÓRIO",
  "LABORATÓRIO DE PRÓTESE",
  "RADIOLOGIA ODONTOLÓGICA",
  "PLANNING CENTER",
  "EMPRESA DE ALINHADORES",
  "GESTOR DE REDE DE CLÍNICAS",
  "GESTOR DE FRANQUIAS",
  "CENTRAL DE IMPRESSÕES",
  "EDUCAÇÃO",
];
const AREA_ATUACAO_LOOKUP = buildCanonicalLookup(AREA_ATUACAO_CANONICAL);

export function normalizeAreaAtuacao(raw: string | undefined): string | null {
  const slug = slugify(raw);
  if (!slug) return null;
  return AREA_ATUACAO_LOOKUP.get(slug) ?? null;
}

// 2. Especialidade
const ESPECIALIDADE_CANONICAL = [
  "CLÍNICO GERAL",
  "DENTÍSTICA",
  "IMPLANTODONTISTA",
  "PROTESISTA",
  "ORTODONTISTA",
  "ODONTOPEDIATRIA",
  "PERIODONTISTA",
  "ENDODONTISTA",
  "RADIOLOGISTA",
  "CIRURGIA BUCO MAXILO FACIAL",
  "TÉCNICO EM RADIOLOGIA",
  "TÉCNICO EM PRÓTESE ODONTOLÓGICA",
  "OUTROS",
];
const ESPECIALIDADE_LOOKUP = buildCanonicalLookup(ESPECIALIDADE_CANONICAL);

export function normalizeEspecialidade(raw: string | undefined): string | null {
  const slug = slugify(raw);
  if (!slug) return null;
  return ESPECIALIDADE_LOOKUP.get(slug) ?? null;
}

// 3. Scanner
const SCANNER_MODEL_CANONICAL = [
  "Medit i500", "Medit i600", "Medit i700", "Medit i700 Wireless", "Medit i900",
  "BLZ Dental INO200", "BLZ Dental INO100 Plus", "BLZ Dental Leap 500",
  "Dentsply Sirona Omnicam", "Dentsply Sirona Omnicam AF", "Dentsply Sirona Primescan",
  "Align iTero Element E1", "Align iTero Element E2", "Align iTero 5D",
  "Align iTero 5D Plus", "Align iTero Lumina",
  "Shining 3D Aoralscan 2", "Shining 3D Aoralscan 3", "Shining 3D Aoralscan 3 Wireless",
  "Shining 3D Aoralscan Elite", "Shining 3D Aoralscan Elite Wireless",
  "Straumann Virtuo Vivo", "Straumann Sirius", "Straumann SIRIOS X3",
  "Dexis - Carestream CS 3600", "Dexis - Carestream CS 3700", "Dexis - Carestream CS 3800",
  "3DISC Heron IOS", "Planmeca Emerald", "Planmeca Emerald S",
  "Helios 500 Scanner", "Panda P3 Scanner", "Panda P2 Scanner",
  "Aidite Rapid 5 Scanner", "Eagle IOS", "Runyes IOS 3.0",
  "Sirona", "Medit", "Outros",
];
const SCANNER_MODEL_LOOKUP = buildCanonicalLookup(SCANNER_MODEL_CANONICAL);

const SCANNER_NAO_DIGITALIZA_SLUGS = new Set([
  slugify("Não ainda não digitalizo"),
  slugify("ainda_não_digitalizo"),
]);

const SCANNER_BRAND_KEYWORDS: Array<{ brand: string; patterns: string[] }> = [
  { brand: "Medit", patterns: ["medit"] },
  { brand: "BLZ", patterns: ["blz"] },
  { brand: "Dentsply Sirona", patterns: ["sirona", "dentsply"] },
  { brand: "Align iTero", patterns: ["itero", "align"] },
  { brand: "Shining 3D", patterns: ["shining", "aoralscan"] },
  { brand: "Straumann", patterns: ["straumann", "virtuo", "sirius"] },
  { brand: "Dexis / Carestream", patterns: ["dexis", "carestream"] },
  { brand: "3DISC", patterns: ["3disc", "heron"] },
  { brand: "Planmeca", patterns: ["planmeca", "emerald"] },
  { brand: "Panda", patterns: ["panda"] },
  { brand: "Aidite", patterns: ["aidite"] },
  { brand: "Eagle", patterns: ["eagle"] },
  { brand: "Runyes", patterns: ["runyes"] },
  { brand: "Helios", patterns: ["helios"] },
];

export interface ScannerNormalizationResult {
  status: "nao_digitaliza" | "modelo_exato" | "marca_fallback" | "nao_reconhecido";
  label: string | null;
}

export function normalizeScanner(raw: string | undefined): ScannerNormalizationResult {
  const slug = slugify(raw);
  if (!slug) return { status: "nao_reconhecido", label: null };

  if (SCANNER_NAO_DIGITALIZA_SLUGS.has(slug)) {
    return { status: "nao_digitaliza", label: "Não digitaliza ainda" };
  }

  const exact = SCANNER_MODEL_LOOKUP.get(slug);
  if (exact) return { status: "modelo_exato", label: exact };

  for (const { brand, patterns } of SCANNER_BRAND_KEYWORDS) {
    if (patterns.some((p) => slug.includes(p))) {
      return { status: "marca_fallback", label: brand };
    }
  }

  return { status: "nao_reconhecido", label: raw ?? null };
}

// 4. Impressora
const IMPRESSORA_NAO_TEM_SLUGS = new Set([
  slugify("não, ainda não tenho."),
  slugify("nao_ainda_nao_tenho"),
]);

const IMPRESSORA_BRAND_CANONICAL = [
  "RAYSHAPE", "PHROZEN", "ANYCUBIC", "FLASHFORGE", "WANHAO", "MIICRAFT",
  "MOONRAY", "SPRINTRAY", "STRAUMANN", "FORMLABS", "STRATASYS", "ELEGOO",
  "ENVISIONTEC", "3DSYSTEM", "PIONEXT", "CREALITY", "ACKURETTA",
  "PHOTOCENTRIC", "KULZER", "WILCOS", "OUTRAS",
];
const IMPRESSORA_BRAND_LOOKUP = buildCanonicalLookup(IMPRESSORA_BRAND_CANONICAL);

export interface ImpressoraNormalizationResult {
  status: "nao_tem" | "marca_exata" | "marca_fallback" | "nao_reconhecido";
  label: string | null;
}

export function normalizeImpressora(raw: string | undefined): ImpressoraNormalizationResult {
  const slug = slugify(raw);
  if (!slug) return { status: "nao_reconhecido", label: null };

  if (IMPRESSORA_NAO_TEM_SLUGS.has(slug) || (slug.includes("nao") && slug.includes("tenho"))) {
    return { status: "nao_tem", label: "Ainda não tenho" };
  }

  const exact = IMPRESSORA_BRAND_LOOKUP.get(slug);
  if (exact) return { status: "marca_exata", label: exact };

  for (const brand of IMPRESSORA_BRAND_CANONICAL) {
    const brandSlug = slugify(brand);
    if (slug.includes(brandSlug)) return { status: "marca_fallback", label: brand };
  }

  return { status: "nao_reconhecido", label: raw ?? null };
}

// 5. Form ID Meta -> Origem / Produto
export interface FormProductMapping {
  formNameMeta: string;
  originSystemB: string;
  productName: string;
}

export const FORM_ID_TO_PRODUCT: Record<string, FormProductMapping> = {
  "1671244647446516": { formNameMeta: "# - FACE - BLZ INO110 PLUS + NOTEBOOK", originSystemB: "# - [META] - BLZ Ino 100 Plus", productName: "Scanner Intraoral BLZ INO100" },
  "1789308268708562": { formNameMeta: "# - GlazeON- Smart Dent", originSystemB: "# - [META] - GlazeON", productName: "GlazeON - Splint" },
  "4309081142703799": { formNameMeta: "# - Impresoras - Smart Dent", originSystemB: "# - [META] - RayShape Edge Mini", productName: "Impressora 3D Rayshape Edge Mini" },
  "1542863750467622": { formNameMeta: "# - PósCura- Smart Dent", originSystemB: "# - [META] - ShapeCure D", productName: "Equipamento UV ShapeCure D" },
  "1340059967915323": { formNameMeta: "# - Exocad - Smart Dent-copy", originSystemB: "# - [META] - Exocad - RMS", productName: "Ativação DentalCAD Ultimate Lab Bundle - RMS" },
  "1769104010546057": { formNameMeta: "# - IoConnect - Smart Dent", originSystemB: "# - [META] - Ioconnect", productName: "ioConnect TruAbutment" },
  "828564006542967":  { formNameMeta: "# - EdgeMini - Smart Dent", originSystemB: "# - [META] - RayShape Edge Mini", productName: "Impressora 3D Rayshape Edge Mini" },
  "1837531123702389": { formNameMeta: "# - FACE - INSUMOS", originSystemB: "# - [META] - Insumos", productName: "Resinas 3D" },
  "520986211045312":  { formNameMeta: "# - FACE - SMARTLAB", originSystemB: "# - [META] - SmartLab", productName: "Scanner de Bancada BLZ LS100" },
  "572509702502163":  { formNameMeta: "# - FACE - UNIKK", originSystemB: "# - [META] - UNIKK Venner", productName: "Kit Cimento Unikk Veneer" },
  "1444741883175011": { formNameMeta: "# - FACE - RESINA ATOS", originSystemB: "# - [META] - Resina ATOS", productName: "Atos Resina Composta Direta" },
  "1591486384851300": { formNameMeta: "# - FACE - SCAN BANCADA BLZ", originSystemB: "# - [META] - BLZ - Bancada", productName: "Scanner de Bancada BLZ LS100" },
  "1656129874991505": { formNameMeta: "# - FACE - SCAN BANCADA MEDIT", originSystemB: "# - [META] - Medit - Bancada", productName: "Scanner de Bancada Medit T310" },
  "1566608407378526": { formNameMeta: "# - FACE - SMAKE/GUM", originSystemB: "# - [META] - SmartMake / SmatGum", productName: "Kit Completo SmartMake" },
  "1000304435411806": { formNameMeta: "# - FACE - NANOCLEAN", originSystemB: "# - [META] - ManoClean Pod", productName: "NanoClean PoD" },
  "1046748587350071": { formNameMeta: "# - FACE - E-BOOK VITALITY", originSystemB: "# - [META] - Resina Vitality", productName: "Resina 3D Smart Print Bio Vitality" },
  "994460442184175":  { formNameMeta: "# - FACE - INTRAORAL MEDIT", originSystemB: "# - [META] - Medit - Scanner intraoral", productName: "Scanner Intraoral MEDIT i700 Wireless" },
  "2127544887708326": { formNameMeta: "# - FACE - RESINAS", originSystemB: "# - [META] - Resinas geral", productName: "Resinas 3D Smart Print" },
  "1853424102139156": { formNameMeta: "BLZ- Smart Dent", originSystemB: "# - [META] - BLZ - Smart A.I. Pro", productName: "Scanner Intraoral BLZ INO200" },
};

export function mapFormToProduct(formId: string | undefined | null): FormProductMapping | null {
  if (!formId) return null;
  return FORM_ID_TO_PRODUCT[formId] ?? null;
}

// 5b. Ponte Meta Graph API -> Record
export interface MetaGraphFieldDatum {
  name: string;
  values: string[];
}

export function metaFieldDataArrayToRecord(
  fieldData: MetaGraphFieldDatum[] | undefined | null,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of fieldData ?? []) {
    if (!field?.name) continue;
    record[field.name] = field.values?.[0] ?? "";
  }
  return record;
}

// 6. Entry point
export interface NormalizedZernioLead {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  areaAtuacao: string | null;
  especialidade: string | null;
  scanner: ScannerNormalizationResult | null;
  impressora: ImpressoraNormalizationResult | null;
  extras: Record<string, string>;
  needsManualReview: boolean;
}

type FieldRole = "fullName" | "email" | "phone" | "area" | "especialidade" | "scanner" | "impressora";

const FIELD_KEY_MAP: Record<string, FieldRole> = {
  [slugify("full_name")]: "fullName",
  [slugify("email")]: "email",
  [slugify("phone_number")]: "phone",
  [slugify("área_de_atuação")]: "area",
  [slugify("Qual sua especialidade?")]: "especialidade",
  [slugify("como_digitaliza_suas_moldagens?")]: "scanner",
  [slugify("tem_impressora?")]: "impressora",
};

export function normalizeZernioLead(rawFields: Record<string, string>): NormalizedZernioLead {
  const result: NormalizedZernioLead = {
    fullName: null,
    email: null,
    phone: null,
    areaAtuacao: null,
    especialidade: null,
    scanner: null,
    impressora: null,
    extras: {},
    needsManualReview: false,
  };

  for (const [rawKey, rawValue] of Object.entries(rawFields)) {
    const keySlug = slugify(rawKey);
    const role = FIELD_KEY_MAP[keySlug];

    switch (role) {
      case "fullName":
        result.fullName = rawValue?.trim() || null;
        break;
      case "email":
        result.email = rawValue?.trim().toLowerCase() || null;
        break;
      case "phone":
        result.phone = rawValue?.trim() || null;
        break;
      case "area":
        result.areaAtuacao = normalizeAreaAtuacao(rawValue);
        if (!result.areaAtuacao) result.needsManualReview = true;
        break;
      case "especialidade":
        result.especialidade = normalizeEspecialidade(rawValue);
        if (!result.especialidade) result.needsManualReview = true;
        break;
      case "scanner":
        result.scanner = normalizeScanner(rawValue);
        if (result.scanner.status === "nao_reconhecido") result.needsManualReview = true;
        break;
      case "impressora":
        result.impressora = normalizeImpressora(rawValue);
        if (result.impressora.status === "nao_reconhecido") result.needsManualReview = true;
        break;
      default:
        result.extras[rawKey] = rawValue;
    }
  }

  return result;
}

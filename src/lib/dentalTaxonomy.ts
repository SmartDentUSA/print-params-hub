export interface TaxonomyOption {
  value: string;
  label: string;
}

export const AREA_ATUACAO_OPTIONS: TaxonomyOption[] = [
  { value: "CLÍNICA OU CONSULTÓRIO", label: "Clínica ou Consultório" },
  { value: "LABORATÓRIO DE PRÓTESE", label: "Laboratório de Prótese" },
  { value: "RADIOLOGIA ODONTOLÓGICA", label: "Radiologia Odontológica" },
  { value: "PLANNING CENTER", label: "Planning Center" },
  { value: "EMPRESA DE ALINHADORES", label: "Empresa de Alinhadores" },
  { value: "GESTOR DE REDE DE CLÍNICAS", label: "Gestor de Rede de Clínicas" },
  { value: "GESTOR DE FRANQUIAS", label: "Gestor de Franquias" },
  { value: "CENTRAL DE IMPRESSÕES", label: "Central de Impressões" },
  { value: "EDUCAÇÃO", label: "Educação" },
];

export const ESPECIALIDADE_OPTIONS: TaxonomyOption[] = [
  { value: "CLÍNICO GERAL", label: "Clínico Geral" },
  { value: "DENTÍSTICA", label: "Dentística" },
  { value: "IMPLANTODONTISTA", label: "Implantodontista" },
  { value: "PROTESISTA", label: "Protesista" },
  { value: "ORTODONTISTA", label: "Ortodontista" },
  { value: "ODONTOPEDIATRIA", label: "Odontopediatria" },
  { value: "PERIODONTISTA", label: "Periodontista" },
  { value: "RADIOLOGISTA", label: "Radiologista" },
  { value: "CIRURGIA BUCO MAXILO FACIAL", label: "Cirurgia Buco Maxilo Facial" },
  { value: "TÉCNICO EM RADIOLOGIA", label: "Técnico em Radiologia" },
  { value: "TÉCNICO EM PRÓTESE ODONTOLÓGICA", label: "Técnico em Prótese Odontológica" },
  { value: "ENDODONTISTA", label: "Endodontista" },
  { value: "OUTROS", label: "Outros" },
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function findOption(options: TaxonomyOption[], raw?: string | null): TaxonomyOption | null {
  if (!raw) return null;
  const n = normalize(raw);
  return options.find((o) => normalize(o.value) === n || normalize(o.label) === n) || null;
}

/** Returns canonical value if match found, otherwise the original raw string (so legacy data is preserved). */
export function canonicalize(options: TaxonomyOption[], raw?: string | null): string {
  if (!raw) return "";
  return findOption(options, raw)?.value ?? raw;
}

/**
 * Mapa canônico de "tipo de impressão" (resin_presentations.print_type) → chave i18n.
 * Conjunto fechado e estável (~19 termos). Fallback: devolve o valor PT original.
 */
const PRINT_TYPE_I18N_KEYS: Record<string, string> = {
  "base dentadura": "kb.catalogo.print_types.base_dentadura",
  "base protese total": "kb.catalogo.print_types.base_protese_total",
  "biomodelos tc quadrante": "kb.catalogo.print_types.biomodelos_tc_quadrante",
  "biomodelos- tc (quadrante)": "kb.catalogo.print_types.biomodelos_tc_quadrante",
  "coroas sobre dente": "kb.catalogo.print_types.coroas_sobre_dente",
  "elemento unitario": "kb.catalogo.print_types.elemento_unitario",
  "facetas": "kb.catalogo.print_types.facetas",
  "guia parcial": "kb.catalogo.print_types.guia_parcial",
  "modelos alinhadores": "kb.catalogo.print_types.modelos_alinhadores",
  "modelos clareamento": "kb.catalogo.print_types.modelos_clareamento",
  "modelos mockup": "kb.catalogo.print_types.modelos_mockup",
  "modelos proteticos arco": "kb.catalogo.print_types.modelos_proteticos_arco",
  "modelos proteticos (arco)": "kb.catalogo.print_types.modelos_proteticos_arco",
  "par zocalados": "kb.catalogo.print_types.par_zocalados",
  "placas miorrelaxantes": "kb.catalogo.print_types.placas_miorrelaxantes",
  "protocolo": "kb.catalogo.print_types.protocolo",
  "protocolos": "kb.catalogo.print_types.protocolo",
  "simulacao gengiva": "kb.catalogo.print_types.simulacao_gengiva",
};

function normalizePrintType(s: string): string {
  return normalize(s).replace(/[().,-]/g, " ").replace(/\s+/g, " ").trim();
}

export function translatePrintType(
  value: string | null | undefined,
  t: (key: string, opts?: any) => string,
): string {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const key = PRINT_TYPE_I18N_KEYS[normalizePrintType(raw)];
  if (!key) return raw;
  const tr = t(key);
  // i18next devolve a chave quando não encontra; nesse caso, mantém PT original.
  return tr && tr !== key ? tr : raw;
}
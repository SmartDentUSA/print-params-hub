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
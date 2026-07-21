// Espelha src/lib/dentalTaxonomy.ts para uso em edge functions (Deno).
// Mantenha as listas em sincronia com o formulário do sistema.

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
  { value: "ENDODONTISTA", label: "Endodontista" },
  { value: "RADIOLOGISTA", label: "Radiologista" },
  { value: "CIRURGIA BUCO MAXILO FACIAL", label: "Cirurgia Buco Maxilo Facial" },
  { value: "TÉCNICO EM RADIOLOGIA", label: "Técnico em Radiologia" },
  { value: "TÉCNICO EM PRÓTESE ODONTOLÓGICA", label: "Técnico em Prótese Odontológica" },
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

/** Tenta resolver resposta numérica (1-based) ou textual para uma opção canônica. */
export function resolveTaxonomyAnswer(
  options: TaxonomyOption[],
  raw: string,
): TaxonomyOption | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const numMatch = trimmed.match(/^\s*(\d{1,2})\b/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx];
  }
  return findOption(options, trimmed);
}

export function renderNumberedList(options: TaxonomyOption[]): string {
  return options.map((o, i) => `${i + 1}) ${o.label}`).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonicalizers (deterministic, rule-based). Aplicados no ingest e no backfill
// para normalizar payloads Meta/Sellflux vindos com acento, underscore e
// variações livres. Preserva raw em campos de auditoria.
// ─────────────────────────────────────────────────────────────────────────────

function n(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-.,;/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonicaliza área de atuação. Retorna valor do enum ou null (sem OUTROS). */
export function canonicalizeArea(raw: string | null | undefined): string | null {
  const s = n(raw);
  if (!s) return null;
  const direct = findOption(AREA_ATUACAO_OPTIONS, raw);
  if (direct) return direct.value;
  if (/(clinica|consultorio)/.test(s)) return "CLÍNICA OU CONSULTÓRIO";
  if (/(laboratorio|lab\b|protetico|lab de protese)/.test(s)) return "LABORATÓRIO DE PRÓTESE";
  if (/(radiologia|raio ?x|imagem)/.test(s) && !/tecnico/.test(s)) return "RADIOLOGIA ODONTOLÓGICA";
  if (/planning/.test(s)) return "PLANNING CENTER";
  if (/alinhador/.test(s)) return "EMPRESA DE ALINHADORES";
  if (/rede de clinicas|rede clinicas|gestor de rede/.test(s)) return "GESTOR DE REDE DE CLÍNICAS";
  if (/franquia/.test(s)) return "GESTOR DE FRANQUIAS";
  if (/central de impressao|central de impressoes/.test(s)) return "CENTRAL DE IMPRESSÕES";
  if (/(educacao|professor|docente|universidade|faculdade|ensino)/.test(s)) return "EDUCAÇÃO";
  return null;
}

/** Canonicaliza especialidade. Retorna valor do enum; fallback OUTROS. */
export function canonicalizeSpecialty(raw: string | null | undefined): string | null {
  const s = n(raw);
  if (!s) return null;
  const direct = findOption(ESPECIALIDADE_OPTIONS, raw);
  if (direct) return direct.value;
  if (/(tecnico|tec\b).*(protese|tpd)|tpd|tec protese/.test(s)) return "TÉCNICO EM PRÓTESE ODONTOLÓGICA";
  if (/(tecnico|tec\b).*radiolog/.test(s)) return "TÉCNICO EM RADIOLOGIA";
  if (/(buco|cbmf|cirurgia (bucal|oral|buco))/.test(s)) return "CIRURGIA BUCO MAXILO FACIAL";
  if (/radiolog/.test(s)) return "RADIOLOGISTA";
  if (/endodont|\bendo\b/.test(s)) return "ENDODONTISTA";
  if (/periodont/.test(s)) return "PERIODONTISTA";
  if (/odontopedia/.test(s)) return "ODONTOPEDIATRIA";
  if (/ortodont/.test(s)) return "ORTODONTISTA";
  if (/implanto/.test(s)) return "IMPLANTODONTISTA";
  if (/(protesista|protes[ei]|protetic)/.test(s)) return "PROTESISTA";
  if (/dentistic/.test(s)) return "DENTÍSTICA";
  if (/(clinico|generalista|clinico geral)/.test(s)) return "CLÍNICO GERAL";
  return "OUTROS";
}

// ─── Scanner (como_digitaliza) ────────────────────────────────────────────────
export const SCANNER_OPTIONS: TaxonomyOption[] = [
  { value: "NÃO DIGITALIZO", label: "Não, ainda não digitalizo" },
  { value: "Medit i500", label: "Medit i500" },
  { value: "Medit i600", label: "Medit i600" },
  { value: "Medit i700", label: "Medit i700" },
  { value: "Medit i700 Wireless", label: "Medit i700 Wireless" },
  { value: "Medit i900", label: "Medit i900" },
  { value: "BLZ Dental INO200", label: "BLZ Dental INO200" },
  { value: "BLZ Dental INO100 Plus", label: "BLZ Dental INO100 Plus" },
  { value: "BLZ Dental Leap 500", label: "BLZ Dental Leap 500" },
  { value: "Dentsply Sirona Omnicam", label: "Dentsply Sirona Omnicam" },
  { value: "Dentsply Sirona Omnicam AF", label: "Dentsply Sirona Omnicam AF" },
  { value: "Dentsply Sirona Primescan", label: "Dentsply Sirona Primescan" },
  { value: "Align iTero Element E1", label: "Align iTero Element E1" },
  { value: "Align iTero Element E2", label: "Align iTero Element E2" },
  { value: "Align iTero 5D", label: "Align iTero 5D" },
  { value: "Align iTero 5D Plus", label: "Align iTero 5D Plus" },
  { value: "Align iTero Lumina", label: "Align iTero Lumina" },
  { value: "Shining 3D Aoralscan 2", label: "Shining 3D Aoralscan 2" },
  { value: "Shining 3D Aoralscan 3", label: "Shining 3D Aoralscan 3" },
  { value: "Shining 3D Aoralscan 3 Wireless", label: "Shining 3D Aoralscan 3 Wireless" },
  { value: "Shining 3D Aoralscan Elite", label: "Shining 3D Aoralscan Elite" },
  { value: "Shining 3D Aoralscan Elite Wireless", label: "Shining 3D Aoralscan Elite Wireless" },
  { value: "Straumann Virtuo Vivo", label: "Straumann Virtuo Vivo" },
  { value: "Straumann Sirius", label: "Straumann Sirius" },
  { value: "Straumann SIRIOS X3", label: "Straumann SIRIOS X3" },
  { value: "Dexis - Carestream CS 3600", label: "Dexis - Carestream CS 3600" },
  { value: "Dexis - Carestream CS 3700", label: "Dexis - Carestream CS 3700" },
  { value: "Dexis - Carestream CS 3800", label: "Dexis - Carestream CS 3800" },
  { value: "3DISC Heron IOS", label: "3DISC Heron IOS" },
  { value: "Planmeca Emerald", label: "Planmeca Emerald" },
  { value: "Planmeca Emerald S", label: "Planmeca Emerald S" },
  { value: "Helios 500 Scanner", label: "Helios 500 Scanner" },
  { value: "Panda P3 Scanner", label: "Panda P3 Scanner" },
  { value: "Panda P2 Scanner", label: "Panda P2 Scanner" },
  { value: "Aidite Rapid 5 Scanner", label: "Aidite Rapid 5 Scanner" },
  { value: "Eagle IOS", label: "Eagle IOS" },
  { value: "Runyes IOS 3.0", label: "Runyes IOS 3.0" },
  { value: "OUTROS", label: "Outros" },
];

export interface ScannerCanonical {
  como_digitaliza: string | null;
  scanner_marca: string | null;
  tem_scanner: "SIM" | "NÃO" | null;
}

/** Canonicaliza resposta de scanner/como_digitaliza. */
export function canonicalizeScanner(raw: string | null | undefined): ScannerCanonical {
  const s = n(raw);
  if (!s) return { como_digitaliza: null, scanner_marca: null, tem_scanner: null };
  if (/^(nao|n)$|nao digitalizo|ainda nao digitalizo|nao ainda|nao possuo|nao tenho scanner|nao\b/.test(s)
    && !/tenho|possuo|marca/.test(s)) {
    return { como_digitaliza: "NÃO DIGITALIZO", scanner_marca: null, tem_scanner: "NÃO" };
  }
  // Medit iNNN
  const medit = s.match(/medit\s*i?\s?(500|600|700|900)(\s*wireless)?/);
  if (medit) {
    const model = `Medit i${medit[1]}${medit[2] ? " Wireless" : ""}`;
    return { como_digitaliza: model, scanner_marca: "Medit", tem_scanner: "SIM" };
  }
  if (/\bmedit\b/.test(s)) return { como_digitaliza: "Medit", scanner_marca: "Medit", tem_scanner: "SIM" };
  // iTero
  const itero = s.match(/itero\s*(element\s*e?1|e1|element\s*e?2|e2|5d\s*plus|5d|lumina)/);
  if (itero) {
    const t = itero[1].replace(/element\s*e?/, "e").replace(/\s+/g, " ").trim();
    const map: Record<string, string> = {
      "e1": "Align iTero Element E1",
      "e2": "Align iTero Element E2",
      "5d": "Align iTero 5D",
      "5d plus": "Align iTero 5D Plus",
      "lumina": "Align iTero Lumina",
    };
    return { como_digitaliza: map[t] || "Align iTero Element E1", scanner_marca: "Align", tem_scanner: "SIM" };
  }
  if (/\bitero\b/.test(s)) return { como_digitaliza: "Align iTero Element E1", scanner_marca: "Align", tem_scanner: "SIM" };
  // Aoralscan / Shining 3D
  const aoral = s.match(/aoralscan\s*(2|3\s*wireless|3|elite\s*wireless|elite)/);
  if (aoral) {
    const t = aoral[1].replace(/\s+/g, " ").trim();
    const map: Record<string, string> = {
      "2": "Shining 3D Aoralscan 2",
      "3": "Shining 3D Aoralscan 3",
      "3 wireless": "Shining 3D Aoralscan 3 Wireless",
      "elite": "Shining 3D Aoralscan Elite",
      "elite wireless": "Shining 3D Aoralscan Elite Wireless",
    };
    return { como_digitaliza: map[t] || "Shining 3D Aoralscan 3", scanner_marca: "Shining 3D", tem_scanner: "SIM" };
  }
  // Sirona
  if (/primescan/.test(s)) return { como_digitaliza: "Dentsply Sirona Primescan", scanner_marca: "Dentsply Sirona", tem_scanner: "SIM" };
  if (/omnicam\s*af/.test(s)) return { como_digitaliza: "Dentsply Sirona Omnicam AF", scanner_marca: "Dentsply Sirona", tem_scanner: "SIM" };
  if (/omnicam/.test(s)) return { como_digitaliza: "Dentsply Sirona Omnicam", scanner_marca: "Dentsply Sirona", tem_scanner: "SIM" };
  // Carestream / Dexis
  const cs = s.match(/cs\s*3(600|700|800)/);
  if (cs) return { como_digitaliza: `Dexis - Carestream CS 3${cs[1]}`, scanner_marca: "Dexis", tem_scanner: "SIM" };
  // BLZ
  if (/ino\s*200/.test(s)) return { como_digitaliza: "BLZ Dental INO200", scanner_marca: "BLZ", tem_scanner: "SIM" };
  if (/ino\s*100/.test(s)) return { como_digitaliza: "BLZ Dental INO100 Plus", scanner_marca: "BLZ", tem_scanner: "SIM" };
  if (/leap\s*500/.test(s)) return { como_digitaliza: "BLZ Dental Leap 500", scanner_marca: "BLZ", tem_scanner: "SIM" };
  // Straumann
  if (/virtuo/.test(s)) return { como_digitaliza: "Straumann Virtuo Vivo", scanner_marca: "Straumann", tem_scanner: "SIM" };
  if (/sirios/.test(s)) return { como_digitaliza: "Straumann SIRIOS X3", scanner_marca: "Straumann", tem_scanner: "SIM" };
  if (/\bsirius\b/.test(s)) return { como_digitaliza: "Straumann Sirius", scanner_marca: "Straumann", tem_scanner: "SIM" };
  // Planmeca
  if (/emerald\s*s\b/.test(s)) return { como_digitaliza: "Planmeca Emerald S", scanner_marca: "Planmeca", tem_scanner: "SIM" };
  if (/emerald/.test(s)) return { como_digitaliza: "Planmeca Emerald", scanner_marca: "Planmeca", tem_scanner: "SIM" };
  // 3DISC
  if (/heron/.test(s)) return { como_digitaliza: "3DISC Heron IOS", scanner_marca: "3DISC", tem_scanner: "SIM" };
  // Helios
  if (/helios\s*500/.test(s)) return { como_digitaliza: "Helios 500 Scanner", scanner_marca: "Helios", tem_scanner: "SIM" };
  // Panda
  const panda = s.match(/panda\s*p?\s*([23])/);
  if (panda) return { como_digitaliza: `Panda P${panda[1]} Scanner`, scanner_marca: "Panda", tem_scanner: "SIM" };
  // Aidite
  if (/rapid\s*5|aidite/.test(s)) return { como_digitaliza: "Aidite Rapid 5 Scanner", scanner_marca: "Aidite", tem_scanner: "SIM" };
  // Eagle
  if (/\beagle\b/.test(s)) return { como_digitaliza: "Eagle IOS", scanner_marca: "Eagle", tem_scanner: "SIM" };
  // Runyes
  if (/runyes/.test(s)) return { como_digitaliza: "Runyes IOS 3.0", scanner_marca: "Runyes", tem_scanner: "SIM" };
  // Positive answer but unknown brand
  if (/^(sim|s|possuo|tenho|ja digitalizo|digitalizo|utilizo)/.test(s)) {
    return { como_digitaliza: "OUTROS", scanner_marca: null, tem_scanner: "SIM" };
  }
  return { como_digitaliza: "OUTROS", scanner_marca: null, tem_scanner: "SIM" };
}

// ─── Impressora ───────────────────────────────────────────────────────────────
export const PRINTER_BRAND_OPTIONS: TaxonomyOption[] = [
  { value: "NÃO TENHO", label: "Ainda não tenho" },
  { value: "RAYSHAPE", label: "Rayshape" },
  { value: "PHROZEN", label: "Phrozen" },
  { value: "ANYCUBIC", label: "Anycubic" },
  { value: "FLASHFORGE", label: "FlashForge" },
  { value: "WANHAO", label: "Wanhao" },
  { value: "MIICRAFT", label: "MiiCraft" },
  { value: "MOONRAY", label: "MoonRay" },
  { value: "SPRINTRAY", label: "SprintRay" },
  { value: "STRAUMANN", label: "Straumann" },
  { value: "FORMLABS", label: "Formlabs" },
  { value: "STRATASYS", label: "Stratasys" },
  { value: "ELEGOO", label: "Elegoo" },
  { value: "ENVISIONTEC", label: "EnvisionTEC" },
  { value: "3DSYSTEMS", label: "3D Systems" },
  { value: "PIONEXT", label: "Pionext" },
  { value: "CREALITY", label: "Creality" },
  { value: "ACKURETTA", label: "Ackuretta" },
  { value: "PHOTOCENTRIC", label: "Photocentric" },
  { value: "KULZER", label: "Kulzer" },
  { value: "WILCOS", label: "Wilcos" },
  { value: "OUTRAS", label: "Outras" },
];

const PRINTER_TOKENS: Array<[RegExp, string]> = [
  [/rayshape/, "RAYSHAPE"],
  [/phrozen/, "PHROZEN"],
  [/anycubic/, "ANYCUBIC"],
  [/flashforge/, "FLASHFORGE"],
  [/wanhao/, "WANHAO"],
  [/miicraft|mii\s?craft/, "MIICRAFT"],
  [/moonray/, "MOONRAY"],
  [/sprintray|sprint\s?ray/, "SPRINTRAY"],
  [/strauman[n]?/, "STRAUMANN"],
  [/formlabs|form\s?labs/, "FORMLABS"],
  [/stratasys/, "STRATASYS"],
  [/elegoo/, "ELEGOO"],
  [/envisiontec|envision\s?tec/, "ENVISIONTEC"],
  [/3d\s?systems?|3dsystem/, "3DSYSTEMS"],
  [/pionext/, "PIONEXT"],
  [/creality/, "CREALITY"],
  [/ackuretta/, "ACKURETTA"],
  [/photocentric/, "PHOTOCENTRIC"],
  [/kulzer/, "KULZER"],
  [/wilcos/, "WILCOS"],
];

export interface PrinterCanonical {
  impressora_marca: string | null;
  tem_impressora: "SIM" | "NÃO" | null;
  raw: string | null;
}

/** Canonicaliza resposta de impressora. */
export function canonicalizePrinter(raw: string | null | undefined): PrinterCanonical {
  const s = n(raw);
  if (!s) return { impressora_marca: null, tem_impressora: null, raw: raw ? String(raw) : null };
  if (/^(nao|n)$|nao tenho|ainda nao tenho|nao possuo|nao ainda|sem impressora/.test(s)
    && !/tenho\s+\w/.test(s)) {
    return { impressora_marca: "NÃO TENHO", tem_impressora: "NÃO", raw: raw ? String(raw) : null };
  }
  for (const [re, brand] of PRINTER_TOKENS) {
    if (re.test(s)) return { impressora_marca: brand, tem_impressora: "SIM", raw: raw ? String(raw) : null };
  }
  if (/^(sim|s|possuo|tenho|utilizo|ja tenho)/.test(s)) {
    return { impressora_marca: "OUTRAS", tem_impressora: "SIM", raw: raw ? String(raw) : null };
  }
  return { impressora_marca: "OUTRAS", tem_impressora: "SIM", raw: raw ? String(raw) : null };
}
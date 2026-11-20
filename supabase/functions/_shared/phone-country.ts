// Telefone com código do país a partir do nome do país (lead, evento). Saída: dígitos E.164 sem "+", ou "".
// Usado pela Captura WhatsApp e pelo chat de captura: número estrangeiro digitado sem "+" não pode virar
// DDD brasileiro inventado nem +7/+3 (o que o normalizador brasileiro faz quando o DDD não existe).
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const COUNTRY_CODES: [string[], string][] = [
  [["brasil", "brazil", "br"], "55"],
  [["estados unidos", "eua", "usa", "us", "united states", "united states of america", "canada", "canadá", "ca"], "1"],
  [["mexico", "méxico", "mx"], "52"], [["argentina", "ar"], "54"], [["chile", "cl"], "56"], [["colombia", "colômbia", "co"], "57"],
  [["peru", "pe"], "51"], [["uruguai", "uruguay", "uy"], "598"], [["paraguai", "paraguay", "py"], "595"], [["bolivia", "bolívia", "bo"], "591"],
  [["equador", "ecuador", "ec"], "593"], [["venezuela", "ve"], "58"], [["portugal", "pt"], "351"], [["espanha", "spain", "españa", "es"], "34"],
  [["italia", "itália", "italy", "it"], "39"], [["alemanha", "germany", "deutschland", "de"], "49"], [["franca", "frança", "france", "fr"], "33"],
  [["reino unido", "united kingdom", "uk", "inglaterra", "england", "gb"], "44"], [["china", "cn"], "86"], [["japao", "japão", "japan", "jp"], "81"],
  [["india", "índia", "in"], "91"], [["emirados arabes unidos", "united arab emirates", "uae", "dubai"], "971"],
];
const CC_LOOKUP = new Map<string, string>();
for (const [names, cc] of COUNTRY_CODES) for (const n of names) CC_LOOKUP.set(plain(n), cc);

const BR_DDDS = new Set("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" "));

/** Código telefônico do país pelo nome (pt/en/sigla); "" quando desconhecido. */
export function countryCode(pais: string | null | undefined): string {
  return CC_LOOKUP.get(plain(String(pais ?? ""))) ?? "";
}

const isBrMobile11 = (d: string) => d.length === 11 && BR_DDDS.has(d.slice(0, 2)) && d[2] === "9";

/**
 * Ordem: "+"/"00" explícitos → país principal (do lead) → país de reserva (do evento) → Brasil.
 * Celular brasileiro de 11 dígitos (DDD real + 9) continua Brasil quando o país veio só do evento ou é +1,
 * porque nenhum código de área dos EUA/Canadá tem 9 no meio. Mais de 15 dígitos = números colados → "".
 */
export function normalizePhoneForCountry(raw: string | null | undefined, primaryCountry?: string | null, fallbackCountry?: string | null): string {
  const s = String(raw ?? "").trim();
  let d = s.replace(/\D/g, "");
  if (!d) return "";
  const explicit = s.startsWith("+") || d.startsWith("00");
  if (d.startsWith("00")) d = d.slice(2);
  if (explicit) return d.length >= 8 && d.length <= 15 ? d : "";
  const primary = countryCode(primaryCountry);
  const cc = primary || countryCode(fallbackCountry) || "55";
  if (cc !== "55" && (!primary || cc === "1") && isBrMobile11(d)) return `55${d}`;
  if (cc === "1") {
    if (d.length === 11 && d.startsWith("1")) return d;
    return d.length === 10 ? `1${d}` : "";
  }
  if (cc === "55") {
    d = d.replace(/^0+/, "");
    if ((d.length === 12 || d.length === 13) && d.startsWith("55") && BR_DDDS.has(d.slice(2, 4))) return d;
    // DDD inexistente no Brasil: provavelmente número estrangeiro sem código do país → pedir conferência.
    return (d.length === 10 || d.length === 11) && BR_DDDS.has(d.slice(0, 2)) ? `55${d}` : "";
  }
  if (d.startsWith(cc) && d.length >= cc.length + 8 && d.length <= 15) return d;
  d = d.replace(/^0+/, "");
  const full = cc + d;
  return d.length >= 6 && full.length <= 15 ? full : "";
}

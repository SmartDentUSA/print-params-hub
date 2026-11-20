// Regras puras da captura WhatsApp (testáveis).
export type CaptureType = "lead" | "kol" | "oportunidade";
export type Command = { kind: "type"; type: CaptureType } | { kind: "end" } | { kind: "cancel" } | { kind: "start" };

/** Palavra que abre uma captura; sem ela, mensagens da equipe são conversa normal. */
export const START_WORD = "AUTO";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[.!*]+$/g, "");

/** Palavras exatas: FIM, CANCELAR, 1/LEAD, 2/KOL, 3/OPORTUNIDADE. Qualquer outro texto é anotação. */
export function parseCommand(text: string): Command | null {
  const t = norm(text);
  if (!t) return null;
  if (t === START_WORD) return { kind: "start" };
  if (t === "FIM") return { kind: "end" };
  if (t === "CANCELAR") return { kind: "cancel" };
  if (t === "1" || t === "LEAD") return { kind: "type", type: "lead" };
  if (t === "2" || t === "KOL") return { kind: "type", type: "kol" };
  if (t === "3" || t === "OPORTUNIDADE") return { kind: "type", type: "oportunidade" };
  return null;
}

// ---------- Telefone com código do país ----------
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

/**
 * Telefone em dígitos com código do país (E.164 sem "+"), ou "" quando não dá para confiar.
 * Ordem: "+"/"00" explícitos → país do lead → país do evento → Brasil. Mais de 15 dígitos = números colados.
 */
export function normalizeCapturePhone(raw: string | null | undefined, pais?: string | null, eventCountry?: string | null): string {
  const s = String(raw ?? "").trim();
  let d = s.replace(/\D/g, "");
  if (!d) return "";
  const explicit = s.startsWith("+") || d.startsWith("00");
  if (d.startsWith("00")) d = d.slice(2);
  if (explicit) return d.length >= 8 && d.length <= 15 ? d : "";
  const cc = countryCode(pais) || countryCode(eventCountry) || "55";
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

/** "+1 704 308 9396" / "+55 16 99750 1531" para conferência. */
export function formatPhone(digits: string): string {
  const d = String(digits ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 11 && d.startsWith("1")) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `+55 ${d.slice(2, 4)} ${d.slice(4, -4)} ${d.slice(-4)}`;
  return `+${d}`;
}

/** Números de telefone escritos no texto, um por ocorrência (nunca junta linhas). */
export function phonesInText(text: string): string[] {
  return [...text.matchAll(/\+?\(?\d[\d \t().-]{7,18}\d/g)].map((m) => m[0].trim()).filter((p) => p.replace(/\D/g, "").length >= 8);
}

/** Escolhe o telefone principal e os demais, já com código do país, sem repetir. */
export function pickPhones(candidates: (string | null | undefined)[], pais?: string | null, eventCountry?: string | null): { telefone: string; outros: string[] } {
  const out: string[] = [];
  for (const c of candidates) {
    const n = normalizeCapturePhone(c, pais, eventCountry);
    if (n && !out.includes(n)) out.push(n);
  }
  return { telefone: out[0] ?? "", outros: out.slice(1, 4) };
}

/** E-mail e telefones lidos direto do texto, caso a IA não devolva. */
export function extractFallback(text: string): { email: string; telefone: string; telefones: string[] } {
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "").toLowerCase();
  const telefones = phonesInText(text);
  const first = telefones[0]?.replace(/\D/g, "") ?? "";
  return { email, telefone: first.length >= 10 ? first : "", telefones };
}

/** Nome da oportunidade: "Nome - Empresa" (ou final do telefone quando não há nome). */
export function opportunityName(nome: string, empresa: string, telefone: string): string {
  const n = nome.trim() || (telefone ? `Contato ${telefone.slice(-4)}` : "Contato");
  return (empresa.trim() && !n.toLowerCase().includes(empresa.trim().toLowerCase()) ? `${n} - ${empresa.trim()}` : n).slice(0, 120);
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "application/pdf": "pdf",
};

/** "Nome - 01.jpg". */
export function fileName(base: string, n: number, mime: string | null | undefined): string {
  const ext = EXT[String(mime ?? "").split(";")[0]] ?? (String(mime ?? "").split("/")[1] || "bin");
  return `${base.replace(/[\\/:*?"<>|]+/g, " ").trim()} - ${String(n).padStart(2, "0")}.${ext}`;
}

// ---------- Conferência antes de criar o lead ----------
export type ConfirmField = "nome" | "telefone" | "email";
export type ConfirmChoice = { kind: "edit"; field: ConfirmField } | { kind: "ok" } | null;
type Contact = { nome?: string; telefone?: string; email?: string; empresa?: string; cidade?: string; estado?: string; pais?: string; outros_telefones?: string[] };

/** Menu da conferência: 1 nome, 2 telefone, 3 e-mail, 4 dados corretos. */
export function parseConfirmChoice(text: string): ConfirmChoice {
  const t = norm(text);
  if (t === "1") return { kind: "edit", field: "nome" };
  if (t === "2") return { kind: "edit", field: "telefone" };
  if (t === "3") return { kind: "edit", field: "email" };
  if (t === "4" || t === "OK" || t === "SIM" || t === "CORRETO" || t === "CORRETOS" || t === "DADOS CORRETOS") return { kind: "ok" };
  return null;
}

/** Valida o valor digitado pelo vendedor para o campo escolhido. */
export function validateEdit(field: ConfirmField, text: string, pais?: string | null, eventCountry?: string | null): { value: string } | { error: string } {
  const v = text.trim();
  if (field === "nome") return v.length >= 2 && v.length <= 120 ? { value: v.replace(/\s+/g, " ") } : { error: "Nome inválido. Digite o nome completo:" };
  if (field === "telefone") {
    if (v.replace(/\D/g, "").length > 15) return { error: "Mande só *um* telefone, com o código do país (ex.: +1 704 308 9396 ou +55 16 99750 1531):" };
    const d = normalizeCapturePhone(v, pais, eventCountry);
    return d.length >= 10 ? { value: d } : { error: "Telefone inválido. Digite com o código do país e DDD (ex.: +1 704 308 9396 ou +55 16 99750 1531):" };
  }
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v) ? { value: v.toLowerCase() } : { error: "E-mail inválido. Digite o e-mail correto:" };
}

/** Correções do vendedor sempre prevalecem sobre o que a IA leu. */
export function applyEdits<T extends Contact>(lead: T, edits: Partial<Record<ConfirmField, string>> | null | undefined): T {
  const out = { ...lead };
  for (const f of ["nome", "telefone", "email"] as ConfirmField[]) {
    const v = edits?.[f];
    if (typeof v === "string" && v.trim()) (out as any)[f] = v;
  }
  return out;
}

export const hasContact = (l: Contact) => String(l.email ?? "").includes("@") || String(l.telefone ?? "").replace(/\D/g, "").length >= 10;

export const EDIT_PROMPT: Record<ConfirmField, string> = {
  nome: "Digite o *nome* correto:",
  telefone: "Digite o *telefone* correto com o código do país e DDD (ex.: +1 704 308 9396 ou +55 16 99750 1531):",
  email: "Digite o *e-mail* correto:",
};

/** Resumo enviado ao vendedor depois do FIM, antes de criar o lead. */
export function confirmSummary(typeLabel: string, l: Contact): string {
  const tel = String(l.telefone ?? "").replace(/\D/g, "");
  const local = [l.cidade, l.estado, l.pais].map((s) => String(s ?? "").trim()).filter(Boolean).join(" / ");
  const lines = [
    `📋 *Confira os dados lidos* (${typeLabel})`,
    "",
    `👤 Nome: ${l.nome?.trim() || "—"}`,
    `📱 Telefone: ${tel ? formatPhone(tel) : "—"}`,
    `✉️ E-mail: ${l.email?.trim() || "—"}`,
  ];
  const outros = (l.outros_telefones ?? []).filter((t) => t && t !== tel);
  if (outros.length) lines.push(`☎️ Outros telefones: ${outros.map(formatPhone).join(", ")}`);
  if (l.empresa?.trim()) lines.push(`🏢 Empresa: ${l.empresa.trim()}`);
  if (local) lines.push(`📍 Local: ${local}`);
  if (!hasContact(l)) lines.push("", "⚠️ Falta telefone ou e-mail: use 2 ou 3.");
  lines.push("", "1 - Editar nome", "2 - Editar telefone", "3 - Editar e-mail", "4 - Dados corretos");
  return lines.join("\n");
}

// ---------- Cartão de contato (botão "Salvar contato" do WhatsApp) ----------
export type ContactCard = {
  name: { formatted_name: string; first_name?: string; last_name?: string };
  phones: { phone: string; type: string }[];
  emails?: { email: string; type: string }[];
};

/** Cartão enviado ao vendedor após o lead ser criado; só existe quando há telefone conferido. */
export function contactCard(l: Contact, displayName: string): ContactCard | null {
  const tel = String(l.telefone ?? "").replace(/\D/g, "");
  if (tel.length < 10) return null;
  const nome = String(l.nome ?? "").trim().replace(/\s+/g, " ");
  const formatted = (displayName.trim() || nome || `Contato ${tel.slice(-4)}`).slice(0, 120);
  const [first, ...rest] = (nome || formatted).split(" ");
  const card: ContactCard = {
    name: { formatted_name: formatted, first_name: first, ...(rest.length ? { last_name: rest.join(" ") } : {}) },
    phones: [{ phone: `+${tel}`, type: "CELL" }],
  };
  const email = String(l.email ?? "").trim().toLowerCase();
  if (email.includes("@")) card.emails = [{ email, type: "WORK" }];
  return card;
}

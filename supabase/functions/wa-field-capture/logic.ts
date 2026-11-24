// Regras puras da captura WhatsApp (testáveis).
import { countryCode, normalizePhoneForCountry } from "../_shared/phone-country.ts";
/** Tipos do menu atual (4). */
export type CaptureType = "lead" | "kol" | "oportunidade" | "distribuicao";
/** Valores gravados: inclui os tipos legados de capturas antigas (só leitura e rótulos). */
export type StoredCaptureType = CaptureType | "venda_direta" | "oportunidade_distribuicao";
export type CaptureSubtype = "venda_direta" | "padrao" | "distribuidor" | "oportunidade";
export type Command = { kind: "type"; type: CaptureType; subtype?: CaptureSubtype } | { kind: "end" } | { kind: "cancel" } | { kind: "start" };

/** Palavra que abre uma captura; sem ela, mensagens da equipe são conversa normal. */
export const START_WORD = "AUTO";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[.!*]+$/g, "");

export const MENU = "Responda com o tipo:\n1 - Lead (quer comprar / cliente)\n2 - KOL (profissional para parceria de conteúdo)\n3 - Outra oportunidade (parceria, instituição, imprensa, fornecedor)\n4 - Distribuidor (quer revender ou importar)\n\nDepois mande cartões, áudios, fotos e vídeos e termine com *FIM*. Para desistir: *CANCELAR*.";

/** Comandos exatos; durante a conferência os números continuam sendo tratados pelo menu de edição. 5 e 6 não são mais comando. */
export function parseCommand(text: string): Command | null {
  const t = norm(text);
  if (!t) return null;
  if (t === START_WORD) return { kind: "start" };
  if (t === "FIM") return { kind: "end" };
  if (t === "CANCELAR") return { kind: "cancel" };
  if (t === "1" || t === "LEAD") return { kind: "type", type: "lead" };
  if (t === "2" || t === "KOL") return { kind: "type", type: "kol" };
  if (t === "3" || t === "OPORTUNIDADE") return { kind: "type", type: "oportunidade" };
  if (t === "4" || t === "DISTRIBUIDOR" || t === "DISTRIBUIDORES" || t === "DISTRIBUICAO") return { kind: "type", type: "distribuicao" };
  // Aliases legados, só por texto, já definem o subtipo.
  if (t === "VENDA DIRETA") return { kind: "type", type: "lead", subtype: "venda_direta" };
  if (t === "OPORTUNIDADE DE DISTRIBUICAO" || t === "OPORTUNIDADES DE DISTRIBUICAO") return { kind: "type", type: "distribuicao", subtype: "oportunidade" };
  return null;
}

/** Tipo atual a partir do valor gravado (legados viram tipo + subtipo). */
export function baseType(t: StoredCaptureType): { type: CaptureType; subtype?: CaptureSubtype } {
  if (t === "venda_direta") return { type: "lead", subtype: "venda_direta" };
  if (t === "oportunidade_distribuicao") return { type: "distribuicao", subtype: "oportunidade" };
  return { type: t };
}

/** Subtipo efetivo: o gravado, senão o implícito no tipo legado. */
export const effectiveSubtype = (t: StoredCaptureType, subtype?: CaptureSubtype | null) => subtype ?? baseType(t).subtype ?? null;

/** Lead e Distribuidor perguntam o subtipo uma vez (KOL e Oportunidade não). */
export function needsSubtype(t: StoredCaptureType, subtype?: CaptureSubtype | null): boolean {
  const b = baseType(t).type;
  return (b === "lead" || b === "distribuicao") && !effectiveSubtype(t, subtype);
}

export function subtypeQuestion(t: StoredCaptureType): string {
  return baseType(t).type === "distribuicao"
    ? "Essa empresa já distribui produtos odontológicos? Responda SIM ou NÃO (NÃO = oportunidade de abrir distribuição)."
    : "Esse contato quer comprar direto no evento? Responda SIM ou NÃO.";
}

/** SIM/S ou NÃO/NAO/N; qualquer outra coisa é null. */
export function parseYesNo(text: string): boolean | null {
  const t = norm(text);
  if (t === "SIM" || t === "S") return true;
  if (t === "NAO" || t === "N") return false;
  return null;
}

export function subtypeFromAnswer(t: StoredCaptureType, yes: boolean): CaptureSubtype {
  return baseType(t).type === "distribuicao" ? (yes ? "distribuidor" : "oportunidade") : (yes ? "venda_direta" : "padrao");
}

/** Rótulo único da mensagem final, das respostas, da timeline e da tela. */
export function captureLabel(t: StoredCaptureType, subtype?: CaptureSubtype | null): string {
  const b = baseType(t).type, st = effectiveSubtype(t, subtype);
  if (b === "lead") return st === "venda_direta" ? "Lead do evento — venda direta" : "Lead do evento";
  if (b === "kol") return "KOL do evento";
  if (b === "oportunidade") return "Outra oportunidade do evento";
  return st === "oportunidade" ? "Distribuidor do evento — oportunidade de abrir distribuição" : "Distribuidor do evento";
}

/** Uma única definição governa a seleção do formulário e o propósito enviado à ingestão. */
export function captureFormPurpose(t: StoredCaptureType) {
  const type = baseType(t).type;
  if (type === "lead") return "feira_evento";
  if (type === "kol") return "kol_expansao";
  if (type === "distribuicao") return "distribuicao";
  return "oportunidade_evento";
}

/** Lead (inclusive venda direta) reaproveita o cadastro de visitantes; distribuição nunca entra no fluxo de Vendas. */
export function captureRouting(t: StoredCaptureType, sender?: { id: string; nome_completo: string } | null) {
  const eventSales = baseType(t).type === "lead";
  const formPurpose = captureFormPurpose(t);
  if (eventSales && !sender) throw new Error("Vendedor remetente não encontrado");
  return {
    formPurpose,
    consultant: eventSales && sender ? { event_consultant_team_member_id: sender.id, proprietario_lead_crm: sender.nome_completo } : {},
  };
}

// ---------- Telefone com código do país (regra compartilhada com o chat de captura) ----------
export { countryCode };

/** Dígitos com código do país (E.164 sem "+"), ou "" — país do lead, depois o do evento, depois Brasil. */
export const normalizeCapturePhone = (raw: string | null | undefined, pais?: string | null, eventCountry?: string | null) =>
  normalizePhoneForCountry(raw, pais, eventCountry);

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

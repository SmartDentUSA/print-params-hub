// Regras puras da "Inscrição KOL" (Agenda): candidato a KOL cadastrado pelo vendedor.
// Testadas em kol-candidate_test.ts. Sem acesso a banco/rede aqui.

export const KOL_PIPELINE_ID = 107400;
export const KOL_STAGE_INTERESSADOS = 694355;
/** Proprietário fixo dos deals de candidato (Beatriz Marketing Smart Dent). */
export const KOL_CANDIDATE_OWNER_PIPERUN_ID = 104356;

export type SearchInput = { kind: "phone" | "crm_id" | "invalid"; digits: string };

/** Celular (10–13 dígitos, com ou sem 55) ou ID do CRM (4–9 dígitos). */
export function classifySearchInput(raw: string): SearchInput {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 13) return { kind: "phone", digits };
  if (digits.length >= 4 && digits.length <= 9 && Number(digits) > 0) return { kind: "crm_id", digits };
  return { kind: "invalid", digits };
}

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
export const firstName = (s: unknown) => clean(s).split(" ")[0] ?? "";

/** Origem do deal no funil KOL: "Indicação - {vendedor que indicou}". */
export function buildKolCandidateOrigin(sellerName: string): string {
  return `Indicação - ${clean(sellerName)}`;
}

export function buildKolGroupName(professionalName: string): string {
  return `Smart Dent | KOL ${clean(professionalName)}`.slice(0, 60).trim();
}

/** Mensagem enviada pela Beatriz (Marketing) no grupo recém-criado. */
export function buildKolInviteMessage(p: { professional: string; seller: string; portalUrl: string }): string {
  return [
    `Olá, ${firstName(p.professional) || clean(p.professional)}! Tudo bem? 😊`,
    "Aqui é a Beatriz, do Marketing da Smart Dent.",
    "",
    `O(a) ${clean(p.seller)}, do nosso time comercial, indicou você para uma possível parceria como KOL da Smart Dent! 🦷✨`,
    "",
    "Para darmos continuidade, preencha seus dados no nosso Portal do Profissional Parceiro:",
    "",
    `👉 ${p.portalUrl}`,
    "",
    "Se precisar de ajuda, fico à disposição!",
  ].join("\n");
}

/** Celular no formato 55 + DDD + número (só dígitos); vazio quando inválido. */
export function waDigits(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? d : "";
}

/** Participantes do grupo: vendedor + KOL. O número da Beatriz cria o grupo e já é o administrador. */
export function groupParticipants(sellerPhone: unknown, kolPhone: unknown, adminPhone: unknown): string[] {
  const admin = waDigits(adminPhone);
  const out = new Set<string>();
  for (const p of [sellerPhone, kolPhone]) {
    const d = waDigits(p);
    if (d && d !== admin) out.add(d);
  }
  return [...out];
}

/** Acha o JID do grupo (…@g.us) em qualquer formato de resposta do servidor de WhatsApp. */
export function parseGroupJid(resp: unknown, depth = 0): string | null {
  if (depth > 5 || resp == null) return null;
  if (typeof resp === "string") return /^[\d-]+@g\.us$/.test(resp.trim()) ? resp.trim() : null;
  if (Array.isArray(resp)) {
    for (const v of resp) { const j = parseGroupJid(v, depth + 1); if (j) return j; }
    return null;
  }
  if (typeof resp === "object") {
    for (const v of Object.values(resp as Record<string, unknown>)) { const j = parseGroupJid(v, depth + 1); if (j) return j; }
  }
  return null;
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type NoteSection = { title: string; rows?: Array<[string, unknown]>; lines?: string[] };

/** Nota do deal para validação do Marketing — organizada como o card do profissional. */
export function buildKolCandidateNote(ctx: { origin: string; sections: NoteSection[] }): string {
  const out: string[] = [
    "<b>🦷 Candidato a KOL — validação do Marketing</b>",
    `<b>Origem do lead:</b> ${esc(ctx.origin)}`,
  ];
  for (const s of ctx.sections) {
    const rows = (s.rows ?? []).filter(([, v]) => clean(v) !== "").map(([k, v]) => `<b>${esc(k)}:</b> ${esc(clean(v))}`);
    const lines = (s.lines ?? []).map(clean).filter(Boolean).map((l) => `• ${esc(l)}`);
    if (!rows.length && !lines.length) continue;
    out.push("", `<b>— ${esc(s.title)} —</b>`, ...rows, ...lines);
  }
  return out.join("<br>");
}

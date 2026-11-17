/**
 * Automatic reply to the quick-reply buttons of official WhatsApp campaigns.
 * Same rules as supabase/functions/_shared/wa-button-replies.ts (equivalent labels and default texts).
 */
export function normLabel(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const GROUPS: Record<string, string[]> = {
  ofertas: ["quero saber mais", "quero ver as ofertas"],
  consultor: ["falar com consultor", "falar com vendedor"],
};

export function buttonKey(label: unknown): string {
  const n = normLabel(label);
  for (const [k, list] of Object.entries(GROUPS)) if (list.includes(n)) return k;
  return n;
}

export const DEFAULT_REPLY: Record<string, string> = {
  ofertas: "Que bom, {primeiro_nome}! Veja todas as ofertas da BLACK26 aqui: {link}",
  consultor: "Perfeito, {primeiro_nome}! Fale agora com um consultor da Smart Dent pelo simulador: {link}",
};
export const GENERIC_REPLY = "Obrigado, {primeiro_nome}! Aqui está o link: {link}";
export const MAX_REPLY_CHARS = 1000;

export function defaultReplyText(label: unknown): string {
  return DEFAULT_REPLY[buttonKey(label)] ?? GENERIC_REPLY;
}

/** Preview: fills in the first name and the link; a text without {link} gets the link at the end (same as the server). */
export function previewReply(text: string, firstName: string, link: string): string {
  let t = String(text ?? "").trim();
  if (!t.includes("{link}")) t = `${t} {link}`;
  return t.replace(/\{primeiro_nome\}/g, firstName || "colega").replace(/\{nome\}/g, firstName || "").replace(/\{link\}/g, link).replace(/ {2,}/g, " ").trim();
}

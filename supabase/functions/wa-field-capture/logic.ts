// Regras puras da captura WhatsApp (testáveis).
export type CaptureType = "lead" | "kol" | "oportunidade";
export type Command = { kind: "type"; type: CaptureType } | { kind: "end" } | { kind: "cancel" };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[.!*]+$/g, "");

/** Palavras exatas: FIM, CANCELAR, 1/LEAD, 2/KOL, 3/OPORTUNIDADE. Qualquer outro texto é anotação. */
export function parseCommand(text: string): Command | null {
  const t = norm(text);
  if (!t) return null;
  if (t === "FIM") return { kind: "end" };
  if (t === "CANCELAR") return { kind: "cancel" };
  if (t === "1" || t === "LEAD") return { kind: "type", type: "lead" };
  if (t === "2" || t === "KOL") return { kind: "type", type: "kol" };
  if (t === "3" || t === "OPORTUNIDADE") return { kind: "type", type: "oportunidade" };
  return null;
}

/** E-mail e telefone lidos direto do texto, caso a IA não devolva. */
export function extractFallback(text: string): { email: string; telefone: string } {
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "").toLowerCase();
  const phone = text.match(/\+?\d[\d\s().-]{8,18}\d/)?.[0]?.replace(/\D/g, "") ?? "";
  return { email, telefone: phone.length >= 10 ? phone : "" };
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

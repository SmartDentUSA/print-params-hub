// Reconhecimento da equipe (Team Members) pelo celular.
// Regra única para o login por celular e para as funções da Agenda: qualquer
// celular cadastrado no membro ativo (WhatsApp, instância ou notificação) vale,
// com ou sem 55 e com ou sem o 9º dígito. Compara DDD + últimos 8 dígitos.

export const TEAM_PHONE_FIELDS = ["whatsapp_number", "evolution_phone", "notification_phone"] as const;

export type TeamPhoneRow = {
  id: string;
  whatsapp_number?: string | null;
  evolution_phone?: string | null;
  notification_phone?: string | null;
};

/** DDD (quando houver) + últimos 8 dígitos; ignora 55 e o 9º dígito. */
export function teamPhoneKey(raw: unknown): { ddd: string; tail: string } | null {
  let d = String(raw ?? "").replace(/\D+/g, "");
  while (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 8) return null;
  return { ddd: d.length >= 10 ? d.slice(0, 2) : "", tail: d.slice(-8) };
}

export function teamPhoneMatches(stored: unknown, input: unknown): boolean {
  const a = teamPhoneKey(stored);
  const b = teamPhoneKey(input);
  if (!a || !b || a.tail !== b.tail) return false;
  return !a.ddd || !b.ddd || a.ddd === b.ddd;
}

/** Primeiro membro (lista já filtrada por ativo) com algum celular igual ao informado. */
export function findTeamMemberByPhone<T extends TeamPhoneRow>(list: T[], input: unknown): T | null {
  if (!teamPhoneKey(input)) return null;
  return list.find((t) => TEAM_PHONE_FIELDS.some((f) => teamPhoneMatches(t[f], input))) ?? null;
}

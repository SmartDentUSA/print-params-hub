import { isFieldVisible } from "../_shared/form-conditions.ts";

export const hasAnswer = (value: unknown) => value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0) && (typeof value !== "string" || !!value.trim());
export function parseAnswer(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("[")) {
    try { return JSON.parse(value); } catch { /* legacy text */ }
  }
  return value;
}
export function buildKnownAnswers(fields: any[], profile: Record<string, any>, history: any[]) {
  const answers: Record<string, unknown> = {};
  for (const field of fields) {
    const historical = history.find((r) => r.field_id === field.id ||
      (field.custom_field_name && r.field?.custom_field_name === field.custom_field_name) ||
      (field.db_column && r.field?.db_column === field.db_column));
    const value = [profile[field.db_column], profile.raw_payload?.custom_fields?.[field.custom_field_name], historical?.value].find(hasAnswer);
    if (hasAnswer(value)) answers[field.id] = parseAnswer(value);
  }
  return answers;
}
export function filterPending(questions: any[], answers: Record<string, unknown>) {
  return questions.filter((q) => !hasAnswer(answers[q.id]) && isFieldVisible(q, answers));
}
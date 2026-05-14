export type ConditionOp =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty";

export interface ConditionRule {
  field_id: string;
  op: ConditionOp;
  value?: any;
}

export interface ShowIf {
  logic: "AND" | "OR";
  rules: ConditionRule[];
}

export interface FieldConditions {
  show_if?: ShowIf | null;
}

const isEmpty = (v: any) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

const norm = (v: any) =>
  v === undefined || v === null ? "" : String(v).trim().toLowerCase();

function evalRule(rule: ConditionRule, answers: Record<string, any>): boolean {
  const answer = answers[rule.field_id];
  switch (rule.op) {
    case "is_empty":
      return isEmpty(answer);
    case "is_not_empty":
      return !isEmpty(answer);
    case "equals": {
      if (Array.isArray(answer)) return answer.map(norm).includes(norm(rule.value));
      return norm(answer) === norm(rule.value);
    }
    case "not_equals": {
      if (Array.isArray(answer)) return !answer.map(norm).includes(norm(rule.value));
      return norm(answer) !== norm(rule.value);
    }
    case "in": {
      const list = Array.isArray(rule.value) ? rule.value.map(norm) : [norm(rule.value)];
      if (Array.isArray(answer)) return answer.map(norm).some((a) => list.includes(a));
      return list.includes(norm(answer));
    }
    case "not_in": {
      const list = Array.isArray(rule.value) ? rule.value.map(norm) : [norm(rule.value)];
      if (Array.isArray(answer)) return !answer.map(norm).some((a) => list.includes(a));
      return !list.includes(norm(answer));
    }
    default:
      return true;
  }
}

export function evaluateShowIf(
  conditions: FieldConditions | null | undefined,
  answers: Record<string, any>,
): boolean {
  const showIf = conditions?.show_if;
  if (!showIf || !Array.isArray(showIf.rules) || showIf.rules.length === 0) return true;
  if (showIf.logic === "OR") return showIf.rules.some((r) => evalRule(r, answers));
  return showIf.rules.every((r) => evalRule(r, answers));
}

export function isFieldVisible(
  field: { id: string; conditions?: any },
  answers: Record<string, any>,
): boolean {
  return evaluateShowIf(field.conditions as FieldConditions | null, answers);
}
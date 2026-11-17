// Clona perguntas de um formulário dando novo ID a cada uma e remapeando as condições
// (show_if.rules[].field_id) para os IDs da cópia. Sem isso, as condições apontam para
// perguntas do formulário modelo, a resposta nunca é encontrada e o fluxo pula/mostra
// perguntas na sequência errada.
export function cloneFormFields(
  fields: Record<string, any>[],
  formId: string,
  newId: () => string = () => crypto.randomUUID(),
): Record<string, any>[] {
  const map = new Map<string, string>();
  for (const f of fields) map.set(String(f.id), newId());
  const remap = (conditions: any) => {
    if (!conditions || typeof conditions !== "object") return conditions ?? null;
    const copy = JSON.parse(JSON.stringify(conditions));
    const rules = copy?.show_if?.rules;
    if (Array.isArray(rules)) {
      for (const r of rules) if (r && map.has(String(r.field_id))) r.field_id = map.get(String(r.field_id));
    }
    return copy;
  };
  return fields.map((f) => {
    const { id, created_at: _c, updated_at: _u, ...rest } = f;
    return { ...rest, id: map.get(String(id)), form_id: formId, conditions: remap(f.conditions) };
  });
}

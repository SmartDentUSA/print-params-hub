

## Fix: Respostas do formulário não aparecem na nota HTML do PipeRun

### Causa raiz — Race condition

O fluxo atual tem uma corrida temporal:

```text
PublicFormPage                    Backend
     │                              │
     ├── invoke(ingest-lead) ──────►│
     │                              ├── fire-and-forget: lia-assign ──► busca form_responses (VAZIO!)
     │◄── retorna lead_id ──────────┤                                   monta HTML sem respostas
     │                              │
     ├── insert form_responses ────►│  ← respostas salvas DEPOIS
     ├── invoke(deal-form-note) ───►│  ← nota separada (backup)
```

O `lia-assign` roda ANTES das respostas serem salvas no banco. O `deal-form-note` deveria compensar, mas é um complemento — a nota principal já foi enviada sem as respostas.

### Solução: Passar respostas diretamente no payload do ingest-lead

Em vez de depender de uma query ao banco (que sofre race condition), enviar as respostas do formulário como parte do payload para `smart-ops-ingest-lead`, que as repassa para `lia-assign`.

### Mudanças

**1. `src/pages/PublicFormPage.tsx` (~linha 184-217)**

Adicionar `form_responses` ao payload do `ingest-lead`:

```typescript
const payload: Record<string, any> = {
  source: "form",
  form_name: form.name,
  form_purpose: form.form_purpose,
  // NOVO: enviar respostas inline para evitar race condition
  form_responses: fields
    .filter(f => values[f.id] !== undefined && values[f.id] !== null && values[f.id] !== "")
    .map(f => ({
      label: f.label,
      value: Array.isArray(values[f.id]) ? (values[f.id] as string[]).join(", ") : String(values[f.id]),
    })),
};
```

**2. `supabase/functions/smart-ops-ingest-lead/index.ts` (~linha 306)**

Repassar `form_responses` no body do fire-and-forget para `lia-assign`:

```typescript
body: JSON.stringify({
  lead_id: finalLeadId,
  trigger: ...,
  form_responses: body.form_responses || [],  // NOVO
}),
```

**3. `supabase/functions/smart-ops-lia-assign/index.ts` (~linha 712-727)**

Priorizar respostas recebidas via parâmetro sobre query ao banco:

```typescript
// Fetch form responses — prefer inline (from ingest-lead) over DB query
let formResponsesHTML = "";
const inlineResponses = inputFormResponses; // from request body
try {
  let responses = inlineResponses;
  if (!responses || responses.length === 0) {
    // Fallback: query DB (may still be empty due to race)
    const { data: dbResponses } = await supabase
      .from("smartops_form_field_responses")
      .select("value, field_label")
      .eq("lead_id", lead.id as string);
    responses = dbResponses?.map(r => ({ label: r.field_label, value: r.value })) || [];
  }
  if (responses.length > 0) {
    const items = responses
      .filter(r => r.value)
      .map(r => `• <b>${r.label || "Campo"}:</b> ${r.value}`)
      .join("<br>");
    if (items) {
      formResponsesHTML = `<hr><b>📝 Respostas do Formulário</b><br><br>${items}<br>`;
    }
  }
} catch (e) {
  console.warn("[lia-assign] Failed to fetch form responses:", e);
}
```

Tambem extrair `form_responses` do body do request (onde `lead_id` e `trigger` ja sao extraidos).

### Escopo
| Arquivo | Mudança |
|---------|---------|
| `src/pages/PublicFormPage.tsx` | Adicionar `form_responses` ao payload (~3 linhas) |
| `supabase/functions/smart-ops-ingest-lead/index.ts` | Repassar `form_responses` para lia-assign (~1 linha) |
| `supabase/functions/smart-ops-lia-assign/index.ts` | Aceitar e priorizar respostas inline (~15 linhas) |

### Resultado
- Respostas do formulário aparecerao na nota principal do PipeRun imediatamente
- `deal-form-note` continua como backup (segunda nota separada)
- Sem breaking changes — campo `form_responses` e opcional


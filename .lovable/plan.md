

## Enviar respostas do formulário como nota no Deal do PipeRun

### Problema

O fluxo atual:
1. `PublicFormPage` → chama `smart-ops-ingest-lead` (que dispara `lia-assign` fire-and-forget)
2. `lia-assign` cria/atualiza deal e adiciona nota via `buildSellerNotification`
3. **Depois** disso, `PublicFormPage` grava as respostas em `smartops_form_field_responses`

A nota do deal é criada **antes** das respostas existirem no banco, então as respostas do formulário nunca aparecem no PipeRun.

### Solução

Criar uma **nova Edge Function** `smart-ops-deal-form-note` que:
- Recebe `lead_id` e as respostas do formulário (label + valor)
- Busca o `piperun_id` do lead em `lia_attendances`
- Se o deal existir, adiciona uma nota formatada com as respostas

Chamar essa function no `PublicFormPage.tsx` **após** gravar as field responses, garantindo que a nota seja enviada depois do deal já existir.

### Mudanças

#### 1. Nova Edge Function: `supabase/functions/smart-ops-deal-form-note/index.ts`

- Recebe JSON: `{ lead_id, form_name, responses: [{ label, value }] }`
- Busca `piperun_id` do lead (com retry/polling curto, pois `lia-assign` roda em paralelo)
- Formata nota:
```text
📝 Respostas do Formulário: [Nome do Form]

• Scanner Intraoral: Medit i700
• Software CAD: exocad
• Impressora 3D: Não possuo
...
```
- Chama `addDealNote` via PipeRun API (reutiliza `piperunPost` do `_shared/piperun-field-map.ts`)

#### 2. `src/pages/PublicFormPage.tsx`

Após o bloco que grava `smartops_form_field_responses` (linha ~258), adicionar chamada:
```typescript
// Enviar respostas como nota no deal do PipeRun
const allResponses = fields
  .filter(f => values[f.id])
  .map(f => ({ label: f.label, value: String(values[f.id]) }));

supabase.functions.invoke("smart-ops-deal-form-note", {
  body: { lead_id: leadId, form_name: form.name, responses: allResponses },
}).catch(err => console.warn("Deal note error:", err));
```

Fire-and-forget — não bloqueia o submit do formulário.

### Detalhes técnicos

- A function usa `setTimeout` / retry (3 tentativas com 3s de intervalo) para aguardar o `piperun_id` ser preenchido pelo `lia-assign` que roda em paralelo
- Reutiliza `PIPERUN_API_KEY` dos secrets existentes e a função `piperunPost` do shared
- CORS headers incluídos para chamada do frontend

### Resultado
- Toda submissão de formulário gera automaticamente uma nota no deal do PipeRun com todas as respostas
- O vendedor vê no PipeRun exatamente o que o lead respondeu no formulário


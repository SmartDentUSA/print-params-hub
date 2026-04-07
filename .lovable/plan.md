

## Analise: Caminho A (form_data JSONB) vs. Status Atual

### O que ja existe hoje

O `ingest-lead` ja tem:
1. **Auto-forward dinamico** (linhas 203-217) — qualquer chave do payload que nao seja meta-key e tenha valor primitivo ja e incluida automaticamente no `incomingData`
2. **Retry para colunas inexistentes** (linhas 314-324) — se o Supabase rejeitar uma coluna, o sistema remove e retenta
3. **`form_responses` inline** passado para o `lia-assign` — respostas do formulario ja chegam na nota HTML do PipeRun sem depender de query ao banco
4. **`smartops_form_field_responses`** — tabela separada que persiste cada resposta com `field_label`

### Veredicto: Caminho A faz sentido, mas como COMPLEMENTO

O Caminho A (coluna `form_data` JSONB) resolve um problema real: **campos que NAO tem coluna na tabela `lia_attendances` sao descartados pelo retry** (linha 319 — o sistema deleta a chave e segue). Com `form_data`, esses campos seriam preservados como contexto.

Porem, o sistema ja esta 80% dinamico. O que falta e apenas o "catch-all" para campos sem coluna.

### Plano recomendado: Caminho B simplificado

Adicionar `form_data JSONB` como catch-all, sem remover nada do que ja funciona.

**1. Migration** — Adicionar coluna `form_data` em `lia_attendances`
```sql
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS form_data jsonb DEFAULT '{}'::jsonb;
```

**2. `smart-ops-ingest-lead/index.ts`** — Antes do insert/update, salvar o payload completo do formulario em `form_data` (merge com existente se lead ja existe)
```typescript
if (source === "form" || formName) {
  incomingData.form_data = {
    ...(existingLead?.form_data || {}),
    [formName || "unknown"]: {
      submitted_at: new Date().toISOString(),
      responses: payload.form_responses || {},
      raw_fields: Object.fromEntries(
        Object.entries(payload).filter(([k, v]) => v != null && typeof v !== "object" && !META_KEYS.has(k))
      ),
    },
  };
}
```

**3. `smart-ops-lia-assign/index.ts`** — No bloco de montagem do prompt da IA, injetar `form_data` se existir (ja esta parcialmente implementado via `form_responses` inline; adicionar fallback para `lead.form_data`)

**4. Template de nota HTML** — Ja funciona via `form_responses` inline. O `form_data` serve como persistencia de longo prazo e backup.

### O que NAO muda
- Auto-forward de campos com coluna existente continua funcionando
- `form_responses` inline para o PipeRun continua funcionando
- `smartops_form_field_responses` continua como registro granular
- Campos com `db_column` mapeado para colunas reais continuam salvando diretamente

### Escopo

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | `ADD COLUMN form_data jsonb` |
| `smart-ops-ingest-lead/index.ts` | Salvar payload do form em `form_data` (~10 linhas) |
| `smart-ops-lia-assign/index.ts` | Ler `form_data` como fallback no prompt da IA (~5 linhas) |

### Resultado
- Campos com coluna na tabela: salvos diretamente (como hoje)
- Campos SEM coluna: preservados em `form_data` JSONB (novo)
- Nota do PipeRun: usa `form_responses` inline (como hoje)
- Prompt da IA: usa `form_data` como contexto adicional (novo)
- Zero perda de dados em qualquer cenario


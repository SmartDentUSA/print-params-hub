

# Atualizar Formulário Base + Corrigir Bug do Nome do Lead

## Problemas Identificados

### Bug Crítico: Nome do lead vira nome do formulário
A função `extractField` no `smart-ops-ingest-lead` usa `.includes()` para buscar campos. Quando procura `"name"`, ela encontra `form_name` antes de `nome` porque `"form_name".includes("name")` é `true`. Resultado: o campo `nome` do lead recebe o valor de `form_name` (ex: "📋 Formulário Base (todos os campos)").

### Formulário Base incompleto
O `BASE_FORM_FIELDS` atual tem 39 campos. Faltam colunas relevantes para formulários como: `empresa_website`, `pessoa_nascimento`, `pessoa_linkedin`, `informacao_desejada`, `empresa_porte`, `empresa_ie`, `pais_origem`, `codigo_contrato`, `form_purpose`.

## Alterações

### 1. `supabase/functions/smart-ops-ingest-lead/index.ts` — Corrigir bug do nome

Alterar a extração do `nome` (linha 96) para **excluir** `form_name` da busca. Trocar `extractField` por lógica direta:
```typescript
const nome = payload.nome || payload.full_name || payload.name || payload.user_name ||
  [payload.first_name, payload.last_name].filter(Boolean).join(" ") || "Sem nome";
```

Também adicionar campos extras do payload que o formulário envia diretamente (ex: `empresa_website`, `pessoa_linkedin`, etc.) ao `incomingData`.

### 2. `src/components/SmartOpsFormBuilder.tsx` — Expandir BASE_FORM_FIELDS

Adicionar ~15 campos faltantes ao array `BASE_FORM_FIELDS`:
- **Empresa**: `empresa_website`, `empresa_ie`, `empresa_porte`
- **Pessoa**: `pessoa_nascimento`, `pessoa_linkedin`, `pessoa_facebook`
- **Comercial**: `informacao_desejada`, `temperatura_lead`, `pais_origem`, `codigo_contrato`
- **Form metadata**: `form_purpose` (campo hidden/auto)

Total: ~54 campos cobrindo todas as colunas preenchíveis por formulário.

### 3. `src/components/SmartOpsFormEditor.tsx` — Expandir DB_COLUMNS

Adicionar os novos campos ao mapeamento `DB_COLUMNS` para que apareçam no dropdown "Mapear para" do editor de campos, agrupados nas categorias existentes + novas categorias:
- **Empresa (extras)**: empresa_website, empresa_ie, empresa_porte
- **Pessoa (extras)**: pessoa_nascimento, pessoa_linkedin, pessoa_facebook
- **Comercial**: informacao_desejada, temperatura_lead, pais_origem, codigo_contrato

### 4. `supabase/functions/smart-ops-ingest-lead/index.ts` — Mapear novos campos

Expandir o bloco `incomingData` (linha 146) para incluir os campos adicionados ao formulário base, garantindo que chegam corretamente ao `lia_attendances`.

## Resultado
- Bug do nome corrigido: leads com nome real do usuário
- Formulário Base com ~54 campos = cobertura total de colunas preenchíveis
- Editor de campos com mapeamento completo para clonar formulários especializados


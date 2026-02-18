
# Diagnóstico e Fix: Erro 500 na importação do knowledge_base_llm_optimized

## Causa raiz identificada

Existem **dois problemas distintos** causando o erro 500:

### Problema 1 (337ms / 440ms) — nonProductPayload com company gigante

O novo arquivo `knowledge_base_llm_optimized` tem um objeto `company` muito rico, com `company_videos` contendo dezenas de vídeos do Instagram/YouTube com descrições longas (~25KB só para o company). O `nonProductPayload` envia esse objeto inteiro para a edge function em uma única chamada.

**Evidência**: O banco já tem um registro `company_info` com 25.127+ caracteres de `extra_data` (com todos os vídeos). Isso indica que o objeto é muito grande para o corpo da request — a edge function falha antes mesmo de processar.

### Problema 2 (campo name diferente) — mapCompanyProfile quebra

O `mapCompanyProfile` tenta ler `company.company_name`, mas no novo arquivo o campo é `company.name`. Isso causa `name: undefined` no upsert, o que viola a constraint `NOT NULL` da coluna `name` em `system_a_catalog`.

**Evidência do banco**:
- Registro antigo: `external_id: "company_3b20b85d-..."` com `name: "Nova Empresaxxx"` (quebrado)
- Registro novo: `external_id: "company_3b20b85d-..."` com `name: "Smart Dent"` (correto)

### Problema 3 — Erro de throw no loop de upsert

Na edge function, `throw upsertError` dentro do loop faz a função retornar 500 ao invés de continuar com os outros batches quando há um erro pontual.

## Solução — 2 arquivos

### Arquivo 1: `src/components/AdminApostilaImporter.tsx`

**Mudar o `nonProductPayload` para não incluir `company` diretamente** — em vez disso, fazer a chamada do company separadamente, com o objeto `company` **truncado** (sem `company_videos` que é enorme e desnecessário para o catálogo).

```typescript
// ANTES: envia company inteiro (pode ser 25KB+)
const nonProductPayload = {
  data: {
    company: rawData.company || rawData.company_profile || null,
    categories: ...,
    testimonials: ...,
    ...
  }
}

// DEPOIS: strip company_videos antes de enviar
const companyData = rawData.company || rawData.company_profile || null;
const companyStripped = companyData ? {
  ...companyData,
  company_videos: undefined, // Remove vídeos gigantes
  instagram_videos: undefined,
} : null;

const nonProductPayload = {
  data: {
    company: companyStripped,
    categories: ...,
    testimonials: ...,
    ...
  }
}
```

### Arquivo 2: `supabase/functions/import-system-a-json/index.ts`

**Fix 1 — mapCompanyProfile: suportar ambos `company.name` e `company.company_name`**

```typescript
// ANTES:
name: company.company_name,

// DEPOIS (suporta old e new schema):
name: company.name || company.company_name || 'Smart Dent',
```

**Fix 2 — external_id consistente para company** (evita duplicatas):

```typescript
// ANTES:
external_id: String(company.id || 'company-1'),

// DEPOIS (prefixo fixo para evitar conflito com external_id sem prefixo):
external_id: `company_${company.id || 'main'}`,
```

**Fix 3 — Não throw no loop de upsert** (degradação graciosa):

```typescript
// ANTES:
if (upsertError) {
  console.error('❌ Upsert error:', upsertError)
  stats.errors++
  throw upsertError  // ← mata tudo
}

// DEPOIS:
if (upsertError) {
  console.error('❌ Upsert error:', upsertError)
  stats.errors++
  // continua sem throw — outros batches ainda processam
}
```

**Fix 4 — Remover logs DEBUG** (foram adicionados temporariamente):

```typescript
// Remover o bloco if (mapped.length === 0) { console.log('🔍 DEBUG...') }
```

## Resultado esperado

- Primeiro request (nonProductPayload) completa sem 500 — company sem `company_videos` é pequeno
- Batches de produtos completam normalmente
- Se algum batch falhar, os outros continuam (não quebra tudo)
- O `mapCompanyProfile` grava corretamente com `name: "Smart Dent"`
- External_id do company usa prefixo `company_` consistente

## Seção Técnica

- `company_videos` não é necessário para o catálogo — é usado apenas para o chatbot Dra. L.I.A. via `extra_data`, mas no novo formato esse dado não precisa ser importado para `system_a_catalog`
- O banco tem constraint `name NOT NULL` em `system_a_catalog` — por isso o company com `name: undefined` causava o 500 (constraint violation)
- A mudança no `throw` do loop é importante: com 116 produtos em 8 batches, se um falhar não deve quebrar todos os outros
- Nenhuma migração de banco necessária
- Deploy da edge function é automático


# Fix: Erro "Invalid regular expression" no import-system-a-json

## Causa raiz confirmada

Na função `addSmartLinks` (linha 287 de `supabase/functions/import-system-a-json/index.ts`):

```typescript
const regexExact = new RegExp(`\\b${keyword}\\b`, 'gi')
```

O JSON da apostila contém keywords com texto livre como:
- `"[nome do produto] para [público-alvo]"`
- `"[marca] vs [concorrente]"`

Quando `keyword = "[nome do produto] para [público-alvo]"`, o regex construído fica:
```
/\b[nome do produto] para [público-alvo]\b/gi
```

Isso é uma **classe de caracteres com range inválido** (`n-o`, `e-d`, etc.) → erro fatal `Range out of order in character class` → HTTP 500.

## Solução

Dois ajustes na função `addSmartLinks`:

### Fix 1 — Escapar caracteres especiais do regex antes de construir o pattern

Adicionar uma função `escapeRegex` que torna literais todos os metacaracteres do regex:

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

Usar nas linhas 287 e 311:
```typescript
// Antes (linha 287):
const regexExact = new RegExp(`\\b${keyword}\\b`, 'gi')

// Depois:
const regexExact = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi')

// Antes (linha 311):
const regex = new RegExp(`\\b(${best.keyword})\\b`, 'i')

// Depois:
const regex = new RegExp(`\\b(${escapeRegex(best.keyword)})\\b`, 'i')
```

### Fix 2 — Skip keywords que contenham `[` ou `]` (keywords de template, não de produto)

Keywords como `"[nome do produto] para [público-alvo]"` são claramente **templates de placeholder**, não palavras-chave reais. Além de escapar o regex, vale filtrar antes para não tentar linkar texto-template:

```typescript
// No início do forEach, após o check de length < 4:
if (keyword.includes('[') || keyword.includes(']')) return // skip template keywords
```

## Arquivo modificado

**`supabase/functions/import-system-a-json/index.ts`**

Mudanças específicas:
1. Adicionar função `escapeRegex` (5 linhas, após linha 265)
2. Filtrar keywords com `[` ou `]` (1 linha, dentro do forEach na linha ~283)
3. Usar `escapeRegex(keyword)` nas linhas 287 e 311

Nenhuma mudança de banco, nenhum deploy de outra função, nenhuma alteração de UI.

## Seção Técnica

- O erro ocorria em **100% das chamadas** porque o primeiro batch (empresa/depoimentos) passa pelo `buildSearchIndex` → `addSmartLinks` — e o index já tem keywords inválidas dos produtos do catálogo existente.
- A função `escapeRegex` é padrão MDN: `str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.
- O deploy automático da edge function é necessário após a mudança.

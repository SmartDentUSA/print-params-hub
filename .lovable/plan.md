

# Plano: Corrigir exportação CSV para incluir todos os campos

## Diagnóstico

O código actual já faz `select("*")` com paginação — está correcto. Mas os headers do CSV são extraídos apenas do **primeiro registo** (`Object.keys(allRows[0])`). Se PostgREST omitir alguma key com valor `null` no primeiro registo (raro mas possível com JSONB), esses campos ficam de fora.

## Correção

No `SmartOpsReports.tsx`, alterar a lógica de extração de headers para fazer a **união de todas as keys** de todos os registos. Adicionar também o número de colunas no toast para o utilizador confirmar.

### Alteração na função `exportCSV` (linhas 87-88):

Substituir:
```typescript
const headers = Object.keys(allRows[0]);
```

Por:
```typescript
const headerSet = new Set<string>();
allRows.forEach(row => Object.keys(row).forEach(k => headerSet.add(k)));
const headers = Array.from(headerSet);
```

E actualizar o toast (linha 114) para incluir contagem de colunas:
```typescript
toast({ title: `${allRows.length} leads exportados com ${headers.length} campos` });
```

Nenhuma outra alteração necessária.




# Plano: Corrigir lógica de merge para não sobrescrever valores existentes

## Situacao atual

A edge function `import-leads-csv` ja implementa a logica COALESCE (linhas 186-215): quando `override = false`, ela so preenche campos que estao `null`, `undefined` ou `""`. O front-end ja envia `override: false` por padrao para a maioria dos parsers.

**Porem ha um bug**: na linha 199, `false` e tratado como "vazio", o que faz com que campos booleanos como `ativo_scan = false`, `reuniao_agendada = false` etc. sejam sobrescritos indevidamente pela planilha.

## Correcao

### `supabase/functions/import-leads-csv/index.ts` (linha 199)

Remover `|| existingVal === false` da condicao de merge:

```typescript
// ANTES (bugado)
if (existingVal === null || existingVal === undefined || existingVal === "" || existingVal === false) {

// DEPOIS (correto)
if (existingVal === null || existingVal === undefined || existingVal === "") {
```

Tambem tratar `0` como valor valido (nao sobrescrever campos numericos que sao zero):

```typescript
if (existingVal === null || existingVal === undefined || existingVal === "") {
  updateFields[k] = v;
}
```

Isso ja exclui `0` e `false` naturalmente, pois ambos sao valores validos que nao devem ser sobrescritos.

### Resumo do comportamento apos correcao

| Campo na base | Valor na planilha | Resultado |
|---|---|---|
| `null` / `""` | `"Dr. Silva"` | Preenche com `"Dr. Silva"` |
| `"Dr. João"` | `"Dr. Silva"` | Mantem `"Dr. João"` |
| `false` | `true` | Mantem `false` |
| `0` | `500` | Mantem `0` |
| `tags_crm: ["a"]` | `tags_crm: ["b"]` | Merge: `["a","b"]` |

Nenhuma alteracao no front-end necessaria.


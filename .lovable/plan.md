

# Fix: Usar Hash (Oportunidade) como identificador do deal

## Problema raiz

O CSV exportado pelo PipeRun tem 206 colunas. A estrutura e:
- Coluna 0: `ID` = ID da **proposta**
- Coluna 2: `Hash` = Hash da **proposta**
- Nao existe coluna `ID (Oportunidade)` — o deal e identificado por `Hash (Oportunidade)`

A funcao `findDealId()` so tenta variantes de `"ID (Oportunidade)"`, que nao existe. Resultado: 0 deals parsed em 65.090 linhas.

## Solucao

### 1. Alterar `findDealId()` para usar `Hash (Oportunidade)`

Adicionar `"Hash (Oportunidade)"` como primeira opcao na funcao `findDealId()`. O hash e um identificador unico e estavel do PipeRun.

### 2. Tambem logar as primeiras colunas com sufixo `(Oportunidade)` no debug

Para facilitar debug futuro, logar todas as colunas que contem `(Oportunidade)` no header.

## Arquivo modificado

**`supabase/functions/import-proposals-csv/index.ts`** — linhas 217-225, alterar `findDealId()`:

```typescript
function findDealId(row: string[], colMap: Record<string, number>): string {
  return colAny(row, colMap,
    "Hash (Oportunidade)",     // ← PipeRun usa Hash, nao ID
    "ID (Oportunidade)",
    "Id (Oportunidade)",
    "id (oportunidade)",
  );
}
```

## Impacto

Com essa correcao, as 65.090 linhas serao parseadas corretamente, agrupadas por hash da oportunidade, depois por email da pessoa, e enriquecidas nos leads existentes.


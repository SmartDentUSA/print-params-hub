# Remover depoimentos da aba Catálogo de Produtos

## Diagnóstico
A tabela `system_a_catalog` tem **351 linhas ativas + aprovadas**:
- **120** produtos reais (com `product_category` preenchido)
- **231** linhas sem categoria, das quais **203** são depoimentos ("Dr. Mauro Escolhe…", "Cliente #22", "Dra. Paloma"…) importados por engano em algum momento.

`DealerCatalogGrid` e `auto-inject-product-cards` fazem `select … where active=true` sem exigir categoria, então os depoimentos aparecem como produto.

## Correção (2 camadas)

### 1. Filtro imediato na UI (frontend)
`src/components/smartops/distributors/DealerCatalogGrid.tsx` — adicionar no `.select()`:
- `.not("product_category", "is", null)`
- `.neq("product_category", "")`

Assim o Catálogo passa a mostrar somente os 120 produtos legítimos, sem depender de limpeza no banco.

### 2. Limpeza no banco (opcional, recomendado)
Migração marcando como inativos os registros que claramente não são produto:

```sql
UPDATE public.system_a_catalog
SET active = false,
    approved = false,
    updated_at = now()
WHERE active = true
  AND product_category IS NULL
  AND (
    name ILIKE 'Dr. %' OR
    name ILIKE 'Dra. %' OR
    name ILIKE 'Cliente #%'
  );
```

Isso limpa também o hook `useCatalogProducts` e o edge function `auto-inject-product-cards`, que hoje podem estar linkando esses "produtos" em artigos.

## Fora de escopo
- Não vou mexer em `authors`, `success_stories` ou nas rotas de depoimentos.
- Não vou alterar as outras abas (Distribuidores, Tabela de Preço, Proposta).

## Pergunta
Aplico as **duas camadas** (filtro no frontend + `UPDATE` desativando os 203 depoimentos), ou você prefere só o filtro no frontend e deixa os registros do banco como estão?
